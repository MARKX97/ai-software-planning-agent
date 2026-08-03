import { Prisma, type PrismaClient } from './generated/prisma/client.js';

export interface KnowledgeChunkWrite {
  readonly id: string;
  readonly documentId: string;
  readonly position: number;
  readonly content: string;
  readonly tokenCount: number;
  readonly titlePath: string[];
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly contentHash: string;
  readonly embedding: number[];
}

const BATCH_SIZE = 100;
const SEARCH_BRANCH_LIMIT = 20;
const RRF_K = 60;

export interface KnowledgeSearchCandidate {
  readonly sourceId: string;
  readonly documentId: string;
  readonly chunkId: string;
  readonly title: string;
  readonly logicalPath: string;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
  readonly pageNumber: number | null;
  readonly content: string;
  readonly contentHash: string;
}

export interface HybridKnowledgeSearchInput {
  readonly projectId: string;
  readonly queryText: string;
  readonly queryVector: readonly number[];
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  readonly sourceIds?: readonly string[];
  readonly topK: number;
}

/** Parameterized pgvector writes stay isolated in the database package. */
export async function insertKnowledgeChunks(
  tx: Prisma.TransactionClient,
  chunks: readonly KnowledgeChunkWrite[],
): Promise<void> {
  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const values = chunks.slice(offset, offset + BATCH_SIZE).map(chunkRow);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "knowledge_chunks" (
        "id", "document_id", "position", "content", "token_count",
        "title_path", "line_start", "line_end", "content_hash", "embedding"
      ) VALUES ${Prisma.join(values)}
    `);
  }
}

/** Hybrid search keeps both project and active-revision filters inside PostgreSQL. */
export async function searchKnowledgeChunks(
  client: PrismaClient,
  input: HybridKnowledgeSearchInput,
): Promise<KnowledgeSearchCandidate[]> {
  const filter = sourceFilter(input.sourceIds);
  const vector = queryVector(input);
  const [vectorRows, textRows] = await Promise.all([
    client.$queryRaw<KnowledgeSearchCandidate[]>(Prisma.sql`
      SELECT ${candidateColumns}
      FROM "knowledge_chunks" kc
      JOIN "knowledge_documents" kd ON kd."id" = kc."document_id"
      JOIN "knowledge_revisions" kr ON kr."id" = kd."revision_id"
      JOIN "knowledge_sources" ks ON ks."id" = kd."source_id"
      WHERE ks."project_id" = ${input.projectId}::uuid
        AND ks."deleted_at" IS NULL
        AND ks."status" IN ('ready', 'ready_with_warnings')
        AND kr."is_active" = true
        AND kr."status" IN ('ready', 'ready_with_warnings')
        AND kr."embedding_model" = ${input.embeddingModel}
        AND kr."embedding_dimensions" = ${input.embeddingDimensions}
        AND kc."embedding" IS NOT NULL
        ${filter}
      ORDER BY kc."embedding" <=> ${vector}::vector, kc."id"
      LIMIT ${SEARCH_BRANCH_LIMIT}
    `),
    client.$queryRaw<KnowledgeSearchCandidate[]>(Prisma.sql`
      SELECT ${candidateColumns}
      FROM "knowledge_chunks" kc
      JOIN "knowledge_documents" kd ON kd."id" = kc."document_id"
      JOIN "knowledge_revisions" kr ON kr."id" = kd."revision_id"
      JOIN "knowledge_sources" ks ON ks."id" = kd."source_id"
      CROSS JOIN (SELECT websearch_to_tsquery('simple', ${input.queryText}) AS value) query
      WHERE ks."project_id" = ${input.projectId}::uuid
        AND ks."deleted_at" IS NULL
        AND ks."status" IN ('ready', 'ready_with_warnings')
        AND kr."is_active" = true
        AND kr."status" IN ('ready', 'ready_with_warnings')
        AND kc."search_vector" @@ query."value"
        ${filter}
      ORDER BY ts_rank_cd(kc."search_vector", query."value") DESC, kc."id"
      LIMIT ${SEARCH_BRANCH_LIMIT}
    `),
  ]);
  return reciprocalRankFusion(vectorRows, textRows, input.topK);
}

export function reciprocalRankFusion(
  vectorRows: readonly KnowledgeSearchCandidate[],
  textRows: readonly KnowledgeSearchCandidate[],
  topK: number,
): KnowledgeSearchCandidate[] {
  const ranked = new Map<string, { item: KnowledgeSearchCandidate; score: number }>();
  addRanks(ranked, vectorRows);
  addRanks(ranked, textRows);
  return [...ranked.values()]
    .sort(
      (left, right) =>
        right.score - left.score || left.item.chunkId.localeCompare(right.item.chunkId),
    )
    .slice(0, Math.min(8, Math.max(1, topK)))
    .map(({ item }) => item);
}

function chunkRow(chunk: KnowledgeChunkWrite): Prisma.Sql {
  if (chunk.embedding.length === 0 || chunk.embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding vector is empty or invalid');
  }
  const vector = `[${chunk.embedding.join(',')}]`;
  return Prisma.sql`(
    ${chunk.id}::uuid, ${chunk.documentId}::uuid, ${chunk.position}, ${chunk.content},
    ${chunk.tokenCount}, ${JSON.stringify(chunk.titlePath)}::jsonb, ${chunk.lineStart},
    ${chunk.lineEnd}, ${chunk.contentHash}, ${vector}::vector
  )`;
}

const candidateColumns = Prisma.sql`
  ks."id" AS "sourceId", kd."id" AS "documentId", kc."id" AS "chunkId",
  kd."title", kd."logical_path" AS "logicalPath", kc."line_start" AS "lineStart",
  kc."line_end" AS "lineEnd", kc."page_number" AS "pageNumber",
  kc."content", kc."content_hash" AS "contentHash"
`;

function sourceFilter(sourceIds?: readonly string[]): Prisma.Sql {
  if (!sourceIds?.length) return Prisma.empty;
  const ids = sourceIds.map((id) => Prisma.sql`${id}::uuid`);
  return Prisma.sql`AND ks."id" IN (${Prisma.join(ids)})`;
}

function queryVector(input: HybridKnowledgeSearchInput): string {
  if (
    input.queryVector.length !== input.embeddingDimensions ||
    input.queryVector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error('Query embedding dimension mismatch');
  }
  return `[${input.queryVector.join(',')}]`;
}

function addRanks(
  ranked: Map<string, { item: KnowledgeSearchCandidate; score: number }>,
  rows: readonly KnowledgeSearchCandidate[],
): void {
  rows.slice(0, SEARCH_BRANCH_LIMIT).forEach((item, index) => {
    const current = ranked.get(item.chunkId);
    ranked.set(item.chunkId, {
      item: current?.item ?? item,
      score: (current?.score ?? 0) + 1 / (RRF_K + index + 1),
    });
  });
}
