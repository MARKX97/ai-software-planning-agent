import { z } from 'zod';
import type {
  Artifact,
  ArtifactCitation as ArtifactCitationRow,
  ArtifactType,
} from '@ai-planning/database';
import type { ArtifactCitation } from '@ai-planning/shared';

/**
 * Zod schemas + DTOs for Artifacts endpoints.
 * Source: contracts/openapi.yaml → ArtifactResponse / ArtifactListResponse.
 * @internal
 */
export const ARTIFACT_TYPES: ArtifactType[] = [
  'requirement_report',
  'feasibility_report',
  'risk_report',
  'mvp_plan',
  'platform_recommendation',
  'project_plan',
  'prd',
  'architecture',
  'frontend_spec',
  'backend_spec',
  'ai_coding_rules',
];

export const listArtifactsQuerySchema = z.object({
  type: z.enum(ARTIFACT_TYPES as [ArtifactType, ...ArtifactType[]]).optional(),
});

export type ListArtifactsQuery = z.infer<typeof listArtifactsQuerySchema>;

export interface ArtifactResponse {
  id: string;
  project_id: string;
  type: string;
  type_display_name: string;
  title: string;
  stage: string;
  content?: string | null;
  file_path: string | null;
  size_bytes: number | null;
  format: string;
  created_at: string;
  citations?: ArtifactCitation[];
}

export interface ArtifactListResponse {
  items: ArtifactResponse[];
  total: number;
}

/** Convert a Prisma Artifact row to the full API response shape (with content). */
export function toArtifactResponse(
  a: Artifact & { citations?: ArtifactCitationRow[] },
): ArtifactResponse {
  return {
    id: a.id,
    project_id: a.project_id,
    type: a.type,
    type_display_name: a.type_display_name,
    title: a.title,
    stage: a.stage,
    content: a.content,
    file_path: a.file_path,
    size_bytes: a.size_bytes,
    format: a.format,
    created_at: a.created_at.toISOString(),
    citations: (a.citations ?? []).map(toArtifactCitation),
  };
}

function toArtifactCitation(citation: ArtifactCitationRow): ArtifactCitation {
  return {
    sourceId: citation.source_id,
    documentId: citation.document_id,
    chunkId: citation.chunk_id,
    citationKey: citation.citation_key,
    title: citation.title,
    locator: citation.locator,
    excerpt: citation.excerpt,
    contentHash: citation.content_hash,
  };
}

/** Convert a Prisma Artifact row to the list-item shape (without content). */
export function toArtifactListItem(a: Artifact): ArtifactResponse {
  return {
    id: a.id,
    project_id: a.project_id,
    type: a.type,
    type_display_name: a.type_display_name,
    title: a.title,
    stage: a.stage,
    file_path: a.file_path,
    size_bytes: a.size_bytes,
    format: a.format,
    created_at: a.created_at.toISOString(),
  };
}
