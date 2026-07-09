import { apiRequest } from '@/lib/api-client';
import type { ProjectListResponse, ProjectResponse } from '@/types/api';

export interface ProjectListQuery extends Record<
  string,
  string | number | boolean | null | undefined
> {
  offset?: number;
  limit?: number;
  status?: 'active' | 'completed' | 'failed' | '';
}

export interface CreateProjectInput {
  name: string;
  original_idea: string;
}

export function listProjects(query: ProjectListQuery = {}): Promise<ProjectListResponse> {
  return apiRequest<ProjectListResponse>('/projects', { query });
}

export function createProject(input: CreateProjectInput): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse>('/projects', { method: 'POST', body: input });
}

export function getProject(projectId: string): Promise<ProjectResponse> {
  return apiRequest<ProjectResponse>(`/projects/${projectId}`);
}

export function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}`, { method: 'DELETE' });
}
