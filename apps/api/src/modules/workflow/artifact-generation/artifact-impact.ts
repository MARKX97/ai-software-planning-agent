import type { ArtifactType } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { ARTIFACT_TYPES } from '../stages/model-routing.js';

export interface RegenerationImpact {
  readonly affected_artifacts: ArtifactType[];
  readonly source_ids: string[];
}

interface ImpactArtifact {
  readonly type: ArtifactType;
  readonly createdAt: Date;
  readonly citations: ReadonlyArray<{
    readonly sourceId: string;
    readonly chunkId: string;
    readonly contentHash: string;
  }>;
}

const EVIDENCE_TYPES = ['prd', 'architecture'] as const satisfies readonly ArtifactType[];
const DEPENDENTS: Partial<Record<ArtifactType, readonly ArtifactType[]>> = {
  prd: ['architecture', 'frontend_spec', 'backend_spec', 'project_plan', 'ai_coding_rules'],
  architecture: ['frontend_spec', 'backend_spec', 'project_plan', 'ai_coding_rules'],
};

export async function loadRegenerationImpact(
  db: PrismaService,
  projectId: string,
): Promise<RegenerationImpact | null> {
  const project = await db.client.project.findUnique({
    where: { id: projectId },
    select: { status: true, current_stage: true },
  });
  if (
    !project ||
    !['completed', 'failed'].includes(project.status) ||
    (project.current_stage !== WorkflowStage.COMPLETED &&
      project.current_stage !== WorkflowStage.FAILED)
  ) {
    return null;
  }
  const artifacts = await loadArtifacts(db, projectId);
  if (artifacts.length === 0) return null;
  const citations = artifacts.flatMap((artifact) => artifact.citations);
  const { sources, chunks } = await loadActiveEvidence(
    db,
    projectId,
    citations.map((citation) => citation.chunk_id),
  );
  return deriveRegenerationImpact(
    artifacts.map((artifact) => ({
      type: artifact.type,
      createdAt: artifact.created_at,
      citations: artifact.citations.map((citation) => ({
        sourceId: citation.source_id,
        chunkId: citation.chunk_id,
        contentHash: citation.content_hash,
      })),
    })),
    sources.map((source) => ({ id: source.id, createdAt: source.created_at })),
    new Map(chunks.map((chunk) => [chunk.id, chunk.content_hash])),
  );
}

function loadArtifacts(db: PrismaService, projectId: string) {
  return db.client.artifact.findMany({
    where: { project_id: projectId, deleted_at: null },
    select: {
      type: true,
      created_at: true,
      citations: { select: { source_id: true, chunk_id: true, content_hash: true } },
    },
  });
}

async function loadActiveEvidence(
  db: PrismaService,
  projectId: string,
  chunkIds: readonly string[],
) {
  const [sources, chunks] = await Promise.all([
    db.client.knowledgeSource.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
        status: { in: ['ready', 'ready_with_warnings'] },
      },
      select: { id: true, created_at: true },
    }),
    chunkIds.length
      ? db.client.knowledgeChunk.findMany({
          where: {
            id: { in: [...chunkIds] },
            document: {
              revision: {
                is_active: true,
                source: { project_id: projectId, deleted_at: null },
              },
            },
          },
          select: { id: true, content_hash: true },
        })
      : Promise.resolve([]),
  ]);
  return { sources, chunks };
}

export function deriveRegenerationImpact(
  artifacts: readonly ImpactArtifact[],
  activeSources: ReadonlyArray<{ readonly id: string; readonly createdAt: Date }>,
  activeChunks: ReadonlyMap<string, string>,
): RegenerationImpact | null {
  const affected = new Set<ArtifactType>();
  const sourceIds = new Set<string>();
  const sourceSet = new Set(activeSources.map((source) => source.id));
  for (const type of EVIDENCE_TYPES) {
    const artifact = artifacts.find((item) => item.type === type);
    const newerSources = activeSources.filter(
      (source) => !artifact || source.createdAt > artifact.createdAt,
    );
    const staleCitations =
      artifact?.citations.filter(
        (citation) =>
          !sourceSet.has(citation.sourceId) ||
          activeChunks.get(citation.chunkId) !== citation.contentHash,
      ) ?? [];
    if (newerSources.length || staleCitations.length) affected.add(type);
    newerSources.forEach((source) => sourceIds.add(source.id));
    staleCitations.forEach((citation) => sourceIds.add(citation.sourceId));
  }
  for (const type of [...affected]) addDependents(type, affected);
  const ordered = ARTIFACT_TYPES.filter((type) => affected.has(type));
  return ordered.length ? { affected_artifacts: ordered, source_ids: [...sourceIds].sort() } : null;
}

function addDependents(type: ArtifactType, affected: Set<ArtifactType>): void {
  for (const dependent of DEPENDENTS[type] ?? []) {
    if (affected.has(dependent)) continue;
    affected.add(dependent);
    addDependents(dependent, affected);
  }
}
