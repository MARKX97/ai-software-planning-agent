import type { KnowledgeSource as KnowledgeSourceRow } from '@ai-planning/database';
import type { KnowledgeSource as KnowledgeSourceResponse } from '@ai-planning/shared';

export type SourceWithActiveRevision = KnowledgeSourceRow & {
  revisions: Array<{ revision: number; is_active: boolean }>;
};

export interface KnowledgeSourceListResponse {
  readonly items: KnowledgeSourceResponse[];
  readonly total: number;
}

export function toKnowledgeSourceResponse(
  source: SourceWithActiveRevision,
): KnowledgeSourceResponse {
  return {
    id: source.id,
    project_id: source.project_id,
    kind: source.kind,
    name: source.name,
    mime_type: source.mime_type,
    source_uri: source.source_uri,
    content_hash: source.content_hash,
    status: source.status,
    warning_count: source.warning_count,
    error_code: source.error_code,
    error_message: source.error_message,
    active_revision: source.revisions.find((revision) => revision.is_active)?.revision ?? null,
    created_at: source.created_at.toISOString(),
    updated_at: source.updated_at.toISOString(),
  };
}
