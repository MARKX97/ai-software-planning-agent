/**
 * WorkflowPipelineRunner — executes the 9-stage pipeline end-to-end.
 *
 * Extracted from {@link WorkflowService} to keep the service under the 200-line
 * limit (AGENTS.md §1.5). Owns the stage loop, state machine, error mapping,
 * and per-stage persistence side effects (`analysis_results`, `requirement_text`).
 *
 * @internal
 */
import {
  AllModelsFailedError,
  LLMAuthError,
  LLMError,
  LLMNetworkError,
  LLMRateLimitError,
  LLMSchemaValidationError,
  LLMTimeoutError,
  type LlmOrchestratorService,
} from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type StageResult, type WorkflowContext } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { WorkflowStateMachine } from './state-machine/workflow-state-machine.js';
import { waitingForUser } from './workflow-checkpoints.js';
import {
  markStageCompleted,
  markStageRunning,
  markStageWaiting,
} from './workflow-state-persister.js';
import { createStageRegistry } from './stages/stage-registry.js';
import type { StageDeps } from './stages/stage-deps.js';
import type { StageProcessor } from './stages/stage-processor.js';
import { persistAnalysisResult } from './stages/analysis-result-persister.js';
import type { MultiModelResult } from './stages/multi-model-analysis.stage.js';

export interface PipelineRunDeps {
  readonly db: PrismaService;
  readonly orchestrator: LlmOrchestratorService;
  readonly dataDir: string;
}

export interface PipelineRunOptions {
  readonly startStage?: WorkflowStage;
}

/** Run the pipeline until completion or until clarification needs user input. */
export async function runPipeline(
  ctx: WorkflowContext,
  deps: PipelineRunDeps,
  options: PipelineRunOptions = {},
): Promise<WorkflowStage> {
  const stateMachine = new WorkflowStateMachine();
  const stageDeps: StageDeps = {
    orchestrator: deps.orchestrator,
    db: deps.db,
    dataDir: deps.dataDir,
  };
  const registry = createStageRegistry(stageDeps);
  let currentStage = options.startStage ?? pickStartingStage(ctx);
  while (!stateMachine.isTerminal(currentStage)) {
    const processor = registry.get(currentStage);
    if (!processor) {
      throw new Error(`No processor registered for stage '${currentStage}'`);
    }
    await updateProjectStage(deps.db, ctx.projectId, currentStage);
    await markStageRunning(deps.db, ctx.projectId, currentStage, stateMachine);
    const result = await runStage(processor, ctx);
    ctx.resultsByStage[currentStage] = result;
    await persistAnalysisResult(deps.db, ctx.projectId, ctx.executionId, currentStage, result);
    await markStageCompleted(deps.db, ctx.projectId, currentStage, result, stateMachine);
    if (currentStage === WorkflowStage.REQUIREMENT_SYNTHESIS) {
      await updateRequirementText(deps.db, ctx.projectId, result);
    }
    const waitingFor = waitingForUser(currentStage, result, ctx.clarificationRound);
    if (waitingFor) {
      await updateProjectStage(deps.db, ctx.projectId, currentStage);
      await markStageWaiting(
        deps.db,
        ctx.projectId,
        currentStage,
        result,
        stateMachine,
        waitingFor,
      );
      return currentStage;
    }
    const next = decideNextStage(stateMachine, currentStage, result);
    currentStage = next;
  }
  await updateProjectStage(deps.db, ctx.projectId, currentStage);
  return currentStage;
}

function pickStartingStage(ctx: WorkflowContext): WorkflowStage {
  return ctx.resultsByStage[WorkflowStage.REQUIREMENT_ANALYSIS]?.structuredOutput
    ? WorkflowStage.REQUIREMENT_CLARIFICATION
    : WorkflowStage.REQUIREMENT_ANALYSIS;
}

async function runStage(processor: StageProcessor, ctx: WorkflowContext): Promise<StageResult> {
  try {
    return await processor.execute(ctx);
  } catch (error) {
    mapLlmError(error);
    throw error;
  }
}

function decideNextStage(
  stateMachine: WorkflowStateMachine,
  stage: WorkflowStage,
  result: StageResult,
): WorkflowStage {
  if (stage === WorkflowStage.MULTI_MODEL_ANALYSIS) {
    const successCount = (result as MultiModelResult).successCount ?? 0;
    if (successCount === 0) {
      throw AppException.internal(
        '所有模型服务当前均不可用，请稍后重试。',
        ErrorCode.ALL_MODELS_FAILED,
      );
    }
  }
  return stateMachine.nextStage(stage);
}

function mapLlmError(error: unknown): void {
  if (error instanceof AllModelsFailedError) {
    throw AppException.internal(
      '所有模型服务当前均不可用，请稍后重试。',
      ErrorCode.ALL_MODELS_FAILED,
    );
  }
  if (error instanceof LLMTimeoutError) {
    throw AppException.internal('模型响应超时，请稍后重试。', ErrorCode.LLM_TIMEOUT);
  }
  if (error instanceof LLMRateLimitError) {
    throw AppException.internal('请求过于频繁，请稍后再试。', ErrorCode.RATE_LIMITED);
  }
  if (error instanceof LLMAuthError) {
    throw AppException.internal(
      '模型服务配置无效，请联系管理员检查 API Key。',
      ErrorCode.LLM_ERROR,
    );
  }
  if (error instanceof LLMSchemaValidationError) {
    throw AppException.internal('模型返回的数据无法处理，请重新运行工作流。', ErrorCode.LLM_ERROR);
  }
  if (error instanceof LLMNetworkError) {
    throw AppException.internal('暂时无法连接模型服务，请稍后重试。', ErrorCode.LLM_ERROR);
  }
  if (error instanceof LLMError) {
    throw AppException.internal('模型服务暂时不可用，请稍后重试。', ErrorCode.LLM_ERROR);
  }
  if (error instanceof Error && error.message.includes('Cost limit exceeded')) {
    throw AppException.badRequest(
      ErrorCode.COST_LIMIT_EXCEEDED,
      '本项目已达到成本上限，请调整预算后重试。',
    );
  }
}

async function updateProjectStage(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
): Promise<void> {
  await db.client.project.update({
    where: { id: projectId },
    data: { current_stage: stage, updated_at: new Date() },
  });
}

async function updateRequirementText(
  db: PrismaService,
  projectId: string,
  result: StageResult,
): Promise<void> {
  const synthesized = result.structuredOutput as { executive_summary?: string };
  if (synthesized?.executive_summary) {
    await db.client.project.update({
      where: { id: projectId },
      data: { requirement_text: synthesized.executive_summary, updated_at: new Date() },
    });
  }
}
