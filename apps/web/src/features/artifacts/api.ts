import { apiDownload, apiRequest } from '@/lib/api-client';
import type { ArtifactListResponse, ArtifactResponse, ExportResponse } from '@/types/api';

export const ARTIFACT_TYPES = [
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

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export function listArtifacts(projectId: string, type?: string): Promise<ArtifactListResponse> {
  return apiRequest<ArtifactListResponse>(`/projects/${projectId}/artifacts`, {
    query: { type },
  });
}

export function getArtifact(projectId: string, artifactId: string): Promise<ArtifactResponse> {
  return apiRequest<ArtifactResponse>(`/projects/${projectId}/artifacts/${artifactId}`);
}

export function downloadArtifact(projectId: string, artifactId: string): Promise<Blob> {
  return apiDownload(`/projects/${projectId}/artifacts/${artifactId}/download`);
}

export function exportPrd(projectId: string): Promise<ExportResponse> {
  return apiRequest<ExportResponse>(`/projects/${projectId}/export/prd`, {
    method: 'POST',
    body: { format: 'markdown', artifact_types: ['prd'] },
  });
}

export function getExport(projectId: string, exportId: string): Promise<ExportResponse> {
  return apiRequest<ExportResponse>(`/projects/${projectId}/export/${exportId}`);
}

export function getExportDownload(
  projectId: string,
  exportId: string,
  token: string,
): Promise<ExportResponse> {
  return apiRequest<ExportResponse>(`/projects/${projectId}/export/${exportId}/download`, {
    query: { token },
  });
}
