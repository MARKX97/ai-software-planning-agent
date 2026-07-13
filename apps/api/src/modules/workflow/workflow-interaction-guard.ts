import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import type { WorkflowStage } from '@ai-planning/shared';
import { nextStageAfterCheckpoint } from './workflow-checkpoints.js';
import type { WorkflowStatusResponse } from './workflow-response.dto.js';

export function assertWorkflowInteraction(
  status: WorkflowStatusResponse,
  conversationId: string,
  waitingFor?: 'reply' | 'review',
): void {
  if (
    !status.conversation_id ||
    status.conversation_id !== conversationId ||
    !status.waiting_for ||
    (waitingFor && status.waiting_for !== waitingFor)
  ) {
    throw AppException.conflict(ErrorCode.WORKFLOW_STAGE_NOT_CLARIFICATION, '当前不在可讨论状态。');
  }
}

export function nextCheckpointStage(
  status: WorkflowStatusResponse,
  conversationId: string,
  stage: WorkflowStage,
): WorkflowStage {
  assertWorkflowInteraction(status, conversationId, 'review');
  const next = nextStageAfterCheckpoint(stage);
  if (!next) {
    throw AppException.conflict(ErrorCode.WORKFLOW_STAGE_NOT_CLARIFICATION, '当前阶段不能继续。');
  }
  return next;
}
