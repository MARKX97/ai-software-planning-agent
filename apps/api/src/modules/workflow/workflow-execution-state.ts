import type { PrismaService } from '../../database/database.module.js';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../common/exception/app-exception.js';

export async function markExecutionComplete(db: PrismaService, executionId: string): Promise<void> {
  await db.client.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'success', completed_at: new Date() },
  });
}

export async function markExecutionFailed(
  db: PrismaService,
  executionId: string,
  error: unknown,
): Promise<void> {
  await db.client.workflowExecution.update({
    where: { id: executionId },
    data: {
      status: 'failed',
      error_message: workflowFailureMessage(error),
      completed_at: new Date(),
    },
  });
}

export async function markExecutionCancelled(
  db: PrismaService,
  executionId: string,
): Promise<void> {
  await db.client.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'cancelled', error_message: '回复已取消。', completed_at: new Date() },
  });
}

export async function markProjectCancelled(db: PrismaService, projectId: string): Promise<void> {
  await db.client.project.update({
    where: { id: projectId },
    data: {
      status: 'failed',
      current_stage: WorkflowStage.FAILED,
      error_message: '回复已取消，可以重新开始。',
      updated_at: new Date(),
    },
  });
}

export function workflowFailureMessage(error: unknown): string {
  if (error instanceof AppException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return '工作流执行失败，请稍后重试。';
}
