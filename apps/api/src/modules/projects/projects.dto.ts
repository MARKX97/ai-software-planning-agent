import { z } from 'zod';
import type { Project } from '@ai-planning/database';

/**
 * Zod schemas + DTOs for Projects endpoints.
 * Source: contracts/openapi.yaml → CreateProjectRequest / ProjectResponse.
 * @internal
 */
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  original_idea: z.string().min(1).max(10000),
});

export type CreateProjectRequest = z.infer<typeof createProjectSchema>;

export const listProjectsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'completed', 'failed']).optional(),
});

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export interface ProjectResponse {
  id: string;
  name: string;
  original_idea: string;
  status: string;
  current_stage: string;
  requirement_text?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectResponse[];
  total: number;
  offset: number;
  limit: number;
}

/** Convert a Prisma Project row to the API response shape. */
export function toProjectResponse(p: Project): ProjectResponse {
  return {
    id: p.id,
    name: p.name,
    original_idea: p.original_idea,
    status: p.status,
    current_stage: p.current_stage,
    requirement_text: p.requirement_text,
    error_message: p.error_message,
    started_at: p.started_at?.toISOString() ?? null,
    completed_at: p.completed_at?.toISOString() ?? null,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}
