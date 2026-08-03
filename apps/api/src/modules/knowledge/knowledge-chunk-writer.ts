import { insertKnowledgeChunks, type Prisma } from '@ai-planning/database';
import { randomUUID } from 'node:crypto';
import type { ParsedKnowledgeChunk, ParsedKnowledgeDocument } from './knowledge-parser.js';

export interface EmbeddedChunk {
  readonly chunk: ParsedKnowledgeChunk;
  readonly embedding: number[];
}

export interface ChunkWriteInput {
  readonly sourceId: string;
  readonly revisionId: string;
  readonly document: ParsedKnowledgeDocument;
  readonly chunks: readonly EmbeddedChunk[];
  readonly indexerVersion: string;
}

export async function storeIndexChunks(
  tx: Prisma.TransactionClient,
  input: ChunkWriteInput,
): Promise<void> {
  const stored = await tx.knowledgeDocument.create({
    data: {
      source_id: input.sourceId,
      revision_id: input.revisionId,
      logical_path: input.document.name,
      title: input.document.title,
      mime_type: input.document.mimeType,
      content_hash: input.document.contentHash,
      repository_commit: input.document.repositoryCommit,
      metadata: {
        indexerVersion: input.indexerVersion,
        parsedChunks: input.document.chunks.length,
      },
    },
  });
  await insertKnowledgeChunks(
    tx,
    input.chunks.map(({ chunk, embedding }) => ({
      id: randomUUID(),
      documentId: stored.id,
      position: chunk.position,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      titlePath: chunk.titlePath,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      pageNumber: chunk.pageNumber,
      contentHash: chunk.contentHash,
      embedding,
    })),
  );
}
