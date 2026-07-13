import { z } from 'zod';
import type { Export, ExportFormat } from '@ai-planning/database';

/**
 * Zod schemas + DTOs for the Export endpoints.
 * Source: contracts/openapi.yaml → ExportRequest / ExportResponse.
 * @internal
 */
export const EXPORT_FORMATS: ExportFormat[] = ['markdown', 'pdf', 'html', 'json'];

export const EXPORT_ARTIFACT_TYPES = [
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
] as const;

export const exportRequestSchema = z.object({
  format: z.enum(EXPORT_FORMATS as [ExportFormat, ...ExportFormat[]]).default('markdown'),
  artifact_types: z.array(z.enum(EXPORT_ARTIFACT_TYPES)).default([]),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

export interface ExportResponse {
  id: string;
  project_id: string;
  format: string;
  status: string;
  artifact_count: number;
  file_path: string | null;
  file_size_bytes: number | null;
  download_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Convert a Prisma Export row to the API response shape. */
export function toExportResponse(e: Export, downloadToken?: string): ExportResponse {
  return {
    id: e.id,
    project_id: e.project_id,
    format: e.format,
    status: e.status,
    artifact_count: e.artifact_count,
    file_path: e.file_path,
    file_size_bytes: e.file_size_bytes,
    download_url: downloadToken
      ? `/projects/${e.project_id}/export/${e.id}/download?token=${downloadToken}`
      : null,
    error_message: e.error_message,
    created_at: e.created_at.toISOString(),
    completed_at: e.completed_at?.toISOString() ?? null,
  };
}
