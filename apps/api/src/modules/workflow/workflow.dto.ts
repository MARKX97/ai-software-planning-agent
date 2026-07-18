import { z } from 'zod';
import { WORKFLOW_STAGES } from '../usage/usage.dto.js';
import { safeUserTextSchema } from '../../common/security/sensitive-text.js';

/**
 * Zod request/query schemas for the Workflow endpoints.
 * Source: contracts/openapi.yaml → run / continue / executions query.
 * @internal
 */
export const runWorkflowSchema = z.object({
  conversation_id: z.string().uuid().optional(),
});

export type RunWorkflowRequest = z.infer<typeof runWorkflowSchema>;

export const continueWorkflowSchema = z.object({
  conversation_id: z.string().uuid(),
  message: safeUserTextSchema(50000),
});

export type ContinueWorkflowRequest = z.infer<typeof continueWorkflowSchema>;

export const discussWorkflowSchema = continueWorkflowSchema;

export type DiscussWorkflowRequest = z.infer<typeof discussWorkflowSchema>;

export const advanceWorkflowSchema = z.object({
  conversation_id: z.string().uuid(),
});

export type AdvanceWorkflowRequest = z.infer<typeof advanceWorkflowSchema>;

export const listExecutionsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  stage: z.enum(WORKFLOW_STAGES).optional(),
  status: z.enum(['success', 'failed', 'timeout', 'cancelled']).optional(),
});

export type ListExecutionsQuery = z.infer<typeof listExecutionsQuerySchema>;

export const listExecutionLogsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListExecutionLogsQuery = z.infer<typeof listExecutionLogsQuerySchema>;
