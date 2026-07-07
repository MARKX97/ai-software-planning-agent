import type { Project } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';

const RUNNING_STAGES = new Set([
  WorkflowStage.REQUIREMENT_ANALYSIS,
  WorkflowStage.REQUIREMENT_CLARIFICATION,
  WorkflowStage.MULTI_MODEL_ANALYSIS,
  WorkflowStage.REQUIREMENT_SYNTHESIS,
  WorkflowStage.FEASIBILITY_ANALYSIS,
  WorkflowStage.RISK_ANALYSIS,
  WorkflowStage.MVP_COMPRESSION,
  WorkflowStage.PLATFORM_RECOMMENDATION,
  WorkflowStage.PLANNING_GENERATION,
]);

/** Reject starting a second workflow while the current one is active. */
export function assertWorkflowNotRunning(project: Project): void {
  if (project.status === 'active' && RUNNING_STAGES.has(project.current_stage as never)) {
    throw AppException.conflict(
      ErrorCode.WORKFLOW_ALREADY_RUNNING,
      'Workflow is already running for this project',
    );
  }
}

/** Reject continue requests unless the workflow is waiting for clarification. */
export function assertCanContinueWorkflow(project: Project): void {
  if (project.current_stage !== WorkflowStage.REQUIREMENT_CLARIFICATION) {
    throw AppException.conflict(
      ErrorCode.WORKFLOW_STAGE_NOT_CLARIFICATION,
      `Cannot continue workflow from stage '${project.current_stage}'`,
      { current_stage: project.current_stage, expected_stage: 'requirement_clarification' },
    );
  }
}
