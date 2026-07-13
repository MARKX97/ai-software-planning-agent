import { MAX_CLARIFICATION_ROUNDS, WorkflowStage, type StageResult } from '@ai-planning/shared';
import type { ClarificationResult } from './stages/requirement-clarification.stage.js';

export type WorkflowWait = 'reply' | 'review';

export interface WorkflowInteraction {
  readonly waitingFor: WorkflowWait | null;
  readonly nextStage: string | null;
}

const REVIEW_STAGES = new Set<WorkflowStage>([
  WorkflowStage.REQUIREMENT_SYNTHESIS,
  WorkflowStage.MVP_COMPRESSION,
  WorkflowStage.PLATFORM_RECOMMENDATION,
]);

const NEXT_STAGES: Partial<Record<WorkflowStage, WorkflowStage>> = {
  [WorkflowStage.REQUIREMENT_CLARIFICATION]: WorkflowStage.MULTI_MODEL_ANALYSIS,
  [WorkflowStage.REQUIREMENT_SYNTHESIS]: WorkflowStage.FEASIBILITY_ANALYSIS,
  [WorkflowStage.MVP_COMPRESSION]: WorkflowStage.PLATFORM_RECOMMENDATION,
  [WorkflowStage.PLATFORM_RECOMMENDATION]: WorkflowStage.PLANNING_GENERATION,
};

const INTRODUCTIONS: Partial<Record<WorkflowStage, string>> = {
  [WorkflowStage.REQUIREMENT_CLARIFICATION]:
    '需求已经足够清楚了。你可以继续补充或讨论，确认没有遗漏后再进入下一环节。',
  [WorkflowStage.REQUIREMENT_SYNTHESIS]:
    '需求范围已经整理好了。先一起看看有没有需要调整的取舍，确认后再评估可行性和风险。',
  [WorkflowStage.MVP_COMPRESSION]:
    '首版范围已经收好。你可以继续讨论哪些事情必须做、哪些可以晚点做，确认后再确定技术方案。',
  [WorkflowStage.PLATFORM_RECOMMENDATION]:
    '技术方案已经摆在桌面上。你可以继续追问成本、团队匹配度或替代方案，确认后再生成完整计划。',
};

export function waitingForUser(
  stage: WorkflowStage,
  result: StageResult,
  clarificationRound: number,
): WorkflowWait | null {
  if (stage === WorkflowStage.REQUIREMENT_CLARIFICATION) {
    const needsMore = (result as ClarificationResult).needsMoreClarification;
    return needsMore && clarificationRound < MAX_CLARIFICATION_ROUNDS ? 'reply' : 'review';
  }
  return REVIEW_STAGES.has(stage) ? 'review' : null;
}

export function nextStageAfterCheckpoint(stage: WorkflowStage): WorkflowStage | null {
  return NEXT_STAGES[stage] ?? null;
}

export function checkpointIntroduction(stage: WorkflowStage): string {
  return INTRODUCTIONS[stage] ?? '这一步已经完成。你可以继续讨论，确认后再进入下一环节。';
}

export function workflowInteraction(data: unknown): WorkflowInteraction {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { waitingFor: null, nextStage: null };
  }
  const workflow = (data as Record<string, unknown>)['_workflow'];
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return { waitingFor: null, nextStage: null };
  }
  const values = workflow as Record<string, unknown>;
  const waitingFor = values['waiting_for'];
  const nextStage = values['next_stage'];
  return {
    waitingFor: waitingFor === 'reply' || waitingFor === 'review' ? waitingFor : null,
    nextStage: typeof nextStage === 'string' ? nextStage : null,
  };
}
