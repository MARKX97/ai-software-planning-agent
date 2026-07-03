import { Inject, Injectable } from '@nestjs/common';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type StageResult, type WorkflowContext } from '@ai-planning/shared';
import { PrismaService } from '../../database/database.module.js';
import { LLM_ORCHESTRATOR } from '../../llm/llm.constants.js';
import { ProjectsService } from '../projects/projects.service.js';
import { toModelExecutionLogResponse, type ModelExecutionLogResponse } from '../usage/usage.dto.js';
import {
  toWorkflowExecutionDetailResponse,
  toWorkflowExecutionResponse,
  toWorkflowStateResponse,
  type WorkflowExecutionDetailResponse,
  type WorkflowExecutionListResponse,
  type WorkflowExecutionResponse,
  type WorkflowStateListResponse,
  type WorkflowStatusResponse,
} from './workflow-response.dto.js';
import {
  type ContinueWorkflowRequest,
  type ListExecutionLogsQuery,
  type ListExecutionsQuery,
  type RunWorkflowRequest,
} from './workflow.dto.js';
import { runPipeline } from './workflow-pipeline-runner.js';
import { assertCanContinueWorkflow, assertWorkflowNotRunning } from './workflow-guards.js';
import {
  buildWorkflowStatus,
  countModelLogs,
  createExecution,
  findConversationOrFail,
  findExecutionOrFail,
  loadConversationHistory,
  markExecutionComplete,
  markFailed,
  markProjectComplete,
  updateProjectStage,
} from './workflow-store.js';

export interface ExecutionLogsListResponse {
  items: ModelExecutionLogResponse[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Workflow service — runs the full 9-stage pipeline end-to-end via the
 * orchestrator. Persists every stage result to `analysis_results` and every
 * model call to `model_execution_logs`, then updates `project.current_stage`.
 *
 * @internal
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async run(projectId: string, _input: RunWorkflowRequest): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    assertWorkflowNotRunning(project);
    const execution = await createExecution(this.db, projectId);
    await updateProjectStage(this.db, projectId, WorkflowStage.REQUIREMENT_ANALYSIS);
    const ctx = await this.buildContext(projectId, execution.id, project.original_idea);
    return this.executePipeline(projectId, execution.id, ctx);
  }

  async getStatus(projectId: string): Promise<WorkflowStatusResponse> {
    return buildWorkflowStatus(this.db, this.projects, projectId);
  }

  async continue(
    projectId: string,
    input: ContinueWorkflowRequest,
  ): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    await findConversationOrFail(this.db, projectId, input.conversation_id);
    assertCanContinueWorkflow(project);
    await this.db.client.message.create({
      data: { conversation_id: input.conversation_id, role: 'user', content: input.message },
    });
    const execution = await createExecution(this.db, projectId);
    await updateProjectStage(this.db, projectId, WorkflowStage.REQUIREMENT_ANALYSIS);
    const ctx = await this.buildContext(projectId, execution.id, project.original_idea);
    return this.executePipeline(projectId, execution.id, ctx);
  }

  async listStates(projectId: string): Promise<WorkflowStateListResponse> {
    await this.projects.findOrFail(projectId);
    const items = await this.db.client.workflowState.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'asc' },
    });
    return { items: items.map(toWorkflowStateResponse), total: items.length };
  }

  async listExecutions(
    projectId: string,
    query: ListExecutionsQuery,
  ): Promise<WorkflowExecutionListResponse> {
    await this.projects.findOrFail(projectId);
    const where = {
      project_id: projectId,
      ...(query.stage ? { stage: query.stage as never } : {}),
      ...(query.status ? { status: query.status as never } : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.client.workflowExecution.findMany({
        where,
        orderBy: { started_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.client.workflowExecution.count({ where }),
    ]);
    const counts = await countModelLogs(this.db, rows);
    const items: WorkflowExecutionResponse[] = rows.map((e, i) =>
      toWorkflowExecutionResponse(e, counts[i]),
    );
    return { items, total, offset: query.offset, limit: query.limit };
  }

  async getExecution(
    projectId: string,
    executionId: string,
  ): Promise<WorkflowExecutionDetailResponse> {
    await this.projects.findOrFail(projectId);
    const execution = await findExecutionOrFail(this.db, projectId, executionId);
    const logs = await this.db.client.modelExecutionLog.findMany({
      where: { execution_id: executionId },
      orderBy: { created_at: 'asc' },
    });
    return toWorkflowExecutionDetailResponse(execution, logs.length, logs);
  }

  async listExecutionLogs(
    projectId: string,
    executionId: string,
    query: ListExecutionLogsQuery,
  ): Promise<ExecutionLogsListResponse> {
    await this.projects.findOrFail(projectId);
    await findExecutionOrFail(this.db, projectId, executionId);
    const where = { execution_id: executionId };
    const [rows, total] = await Promise.all([
      this.db.client.modelExecutionLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.client.modelExecutionLog.count({ where }),
    ]);
    return {
      items: rows.map(toModelExecutionLogResponse),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  private async executePipeline(
    projectId: string,
    executionId: string,
    ctx: WorkflowContext,
  ): Promise<WorkflowStatusResponse> {
    try {
      const finalStage = await runPipeline(ctx, { db: this.db, orchestrator: this.orchestrator });
      if (finalStage === WorkflowStage.COMPLETED) {
        await markProjectComplete(this.db, projectId);
      }
    } catch (error) {
      await markFailed(this.db, projectId, executionId, error);
      return buildWorkflowStatus(this.db, this.projects, projectId);
    }
    await markExecutionComplete(this.db, executionId);
    return buildWorkflowStatus(this.db, this.projects, projectId);
  }

  private async buildContext(
    projectId: string,
    executionId: string,
    originalIdea: string,
  ): Promise<WorkflowContext> {
    const conversationHistory = await loadConversationHistory(this.db, projectId);
    return {
      projectId,
      executionId,
      originalIdea,
      conversationHistory,
      clarificationRound: 0,
      resultsByStage: {} as Record<WorkflowStage, StageResult>,
    };
  }
}
