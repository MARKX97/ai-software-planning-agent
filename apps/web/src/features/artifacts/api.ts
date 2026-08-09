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

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  requirement_report: '需求报告',
  feasibility_report: '可行性报告',
  risk_report: '风险报告',
  mvp_plan: 'MVP 计划',
  platform_recommendation: '平台推荐',
  project_plan: '项目计划',
  prd: 'PRD',
  architecture: '架构设计',
  frontend_spec: '前端规格',
  backend_spec: '后端规格',
  ai_coding_rules: 'AI 编码规则',
};

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
  downloadUrl: string,
): Promise<Blob> {
  if (downloadUrl) return apiDownload(downloadUrl);
  return apiDownload(`/projects/${projectId}/export/${exportId}/download`);
}
