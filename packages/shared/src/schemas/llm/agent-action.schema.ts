/** Zod mirror of `contracts/schemas/llm/agent-action.json`. */
import { z } from 'zod';

const projectIdSchema = z.string().uuid();

export const safeToolLocatorSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isSafeLocator, 'Unsafe locator');

const searchKnowledgeActionSchema = z
  .object({
    tool: z.literal('searchKnowledge'),
    input: z
      .object({
        projectId: projectIdSchema,
        query: z.string().trim().min(1).max(2000),
        sourceIds: z.array(z.string().uuid()).max(50).optional(),
        topK: z.number().int().min(1).max(8).default(8),
      })
      .strict(),
  })
  .strict();

const readSourceActionSchema = z
  .object({
    tool: z.literal('readSource'),
    input: z
      .object({
        projectId: projectIdSchema,
        documentId: z.string().uuid(),
        locator: safeToolLocatorSchema,
      })
      .strict(),
  })
  .strict();

const inspectRepositoryActionSchema = z
  .object({
    tool: z.literal('inspectRepository'),
    input: z
      .object({
        projectId: projectIdSchema,
        sourceId: z.string().uuid(),
        path: safeToolLocatorSchema.optional(),
        query: z.string().trim().min(1).max(1000).optional(),
      })
      .strict()
      .refine((input) => input.path || input.query, 'Path or query is required'),
  })
  .strict();

const artifactTypeSchema = z.enum([
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
]);

const getArtifactActionSchema = z
  .object({
    tool: z.literal('getArtifact'),
    input: z.object({ projectId: projectIdSchema, artifactType: artifactTypeSchema }).strict(),
  })
  .strict();

export const agentToolActionSchema = z.discriminatedUnion('tool', [
  searchKnowledgeActionSchema,
  readSourceActionSchema,
  inspectRepositoryActionSchema,
  getArtifactActionSchema,
]);

export const agentActionPlanSchema = z
  .object({ actions: z.array(agentToolActionSchema).max(3) })
  .strict();

export type AgentToolAction = z.infer<typeof agentToolActionSchema>;
export type AgentActionPlan = z.infer<typeof agentActionPlanSchema>;

function isSafeLocator(value: string): boolean {
  if (value.startsWith('/') || /^[a-z]:/i.test(value) || value.includes('\\')) return false;
  if (value.includes('\0') || /%(?:2e|2f|5c)/i.test(value)) return false;
  return !value.split('/').includes('..');
}
