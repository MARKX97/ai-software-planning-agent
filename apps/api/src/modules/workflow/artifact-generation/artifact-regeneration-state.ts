import type { ArtifactType } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { ARTIFACT_TYPES } from '../stages/model-routing.js';
import type { RegenerationImpact } from './artifact-impact.js';

export async function retainFailedRegenerationTargets(
  db: PrismaService,
  projectId: string,
  failedTypes: readonly ArtifactType[],
): Promise<void> {
  const state = await findPlanningState(db, projectId);
  const current = record(state?.data_json);
  const previous = pendingImpact(current?.['_regeneration']);
  await db.client.workflowState.update({
    where: { project_id_stage: planningStateKey(projectId) },
    data: {
      data_json: {
        ...current,
        _regeneration: {
          affected_artifacts: orderedTypes(failedTypes),
          source_ids: previous?.source_ids ?? [],
        },
      } as never,
      updated_at: new Date(),
    },
  });
}

export async function retainRegenerationImpact(
  db: PrismaService,
  projectId: string,
  impact: RegenerationImpact,
): Promise<void> {
  const state = await findPlanningState(db, projectId);
  const current = record(state?.data_json);
  await db.client.workflowState.update({
    where: { project_id_stage: planningStateKey(projectId) },
    data: {
      data_json: { ...current, _regeneration: impact } as never,
      updated_at: new Date(),
    },
  });
}

export async function loadPendingRegenerationImpact(
  db: PrismaService,
  projectId: string,
): Promise<RegenerationImpact | null> {
  const state = await findPlanningState(db, projectId);
  return pendingImpact(record(state?.data_json)?.['_regeneration']);
}

export function mergeRegenerationImpacts(
  derived: RegenerationImpact | null,
  pending: RegenerationImpact | null,
): RegenerationImpact | null {
  if (!derived) return pending;
  if (!pending) return derived;
  return {
    affected_artifacts: orderedTypes([
      ...derived.affected_artifacts,
      ...pending.affected_artifacts,
    ]),
    source_ids: [...new Set([...derived.source_ids, ...pending.source_ids])].sort(),
  };
}

function findPlanningState(db: PrismaService, projectId: string) {
  return db.client.workflowState.findUnique({
    where: { project_id_stage: planningStateKey(projectId) },
    select: { data_json: true },
  });
}

function planningStateKey(projectId: string) {
  return { project_id: projectId, stage: WorkflowStage.PLANNING_GENERATION };
}

function pendingImpact(value: unknown): RegenerationImpact | null {
  const data = record(value);
  if (!data) return null;
  const affected = Array.isArray(data['affected_artifacts'])
    ? orderedTypes(data['affected_artifacts'].filter(isArtifactType))
    : [];
  const sourceIds = Array.isArray(data['source_ids'])
    ? data['source_ids'].filter((item): item is string => typeof item === 'string')
    : [];
  return affected.length
    ? { affected_artifacts: affected, source_ids: [...new Set(sourceIds)].sort() }
    : null;
}

function orderedTypes(types: readonly ArtifactType[]): ArtifactType[] {
  const selected = new Set(types);
  return ARTIFACT_TYPES.filter((type) => selected.has(type));
}

function isArtifactType(value: unknown): value is ArtifactType {
  return typeof value === 'string' && ARTIFACT_TYPES.includes(value as ArtifactType);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
