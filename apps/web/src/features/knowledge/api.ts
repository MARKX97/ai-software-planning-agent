import { apiRequest } from '@/lib/api-client';
import type { KnowledgeSourceListResponse, KnowledgeSourceResponse } from '@/types/api';

export function listKnowledgeSources(projectId: string): Promise<KnowledgeSourceListResponse> {
  return apiRequest(`/projects/${projectId}/knowledge/sources`);
}

export function uploadKnowledgeSource(
  projectId: string,
  file: File,
): Promise<KnowledgeSourceResponse> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest(`/projects/${projectId}/knowledge/sources`, { method: 'POST', body });
}

export function importKnowledgeRepository(
  projectId: string,
  repositoryUrl: string,
): Promise<KnowledgeSourceResponse> {
  return apiRequest(`/projects/${projectId}/knowledge/sources/repositories`, {
    method: 'POST',
    body: JSON.stringify({ repository_url: repositoryUrl }),
  });
}

export function reindexKnowledgeSource(
  projectId: string,
  sourceId: string,
): Promise<KnowledgeSourceResponse> {
  return apiRequest(`/projects/${projectId}/knowledge/sources/${sourceId}/reindex`, {
    method: 'POST',
  });
}

export function deleteKnowledgeSource(projectId: string, sourceId: string): Promise<void> {
  return apiRequest(`/projects/${projectId}/knowledge/sources/${sourceId}`, { method: 'DELETE' });
}
