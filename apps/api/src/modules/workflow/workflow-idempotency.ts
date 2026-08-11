import { createHash } from 'node:crypto';
import type { WorkflowContext, WorkflowStage } from '@ai-planning/shared';

export function graphStageKey(
  context: Pick<WorkflowContext, 'graphRunId' | 'logicalAttempt'>,
  stage: WorkflowStage,
  suffix: string,
): string | undefined {
  if (!context.graphRunId || !context.logicalAttempt) return undefined;
  return `${context.graphRunId}:${stage}:${context.logicalAttempt}:${suffix}`;
}

export function modelCallKey(input: {
  graphRunId: string;
  logicalAttempt: number;
  stage: WorkflowStage;
  provider: string;
  attemptNumber: number;
  prompt: string;
}): string {
  const promptHash = createHash('sha256').update(input.prompt).digest('hex').slice(0, 24);
  return `${input.graphRunId}:${input.stage}:${input.logicalAttempt}:${input.provider}:${input.attemptNumber}:${promptHash}`;
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}
