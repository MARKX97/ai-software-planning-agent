import { Inject, Injectable } from '@nestjs/common';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage } from '@ai-planning/shared';
import { PrismaService } from '../../database/database.module.js';
import { LLM_ORCHESTRATOR } from '../../llm/llm.constants.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  type WorkflowExecutionDetailResponse,
  type WorkflowExecutionListResponse,
  type WorkflowStateListResponse,
  type WorkflowStatusResponse,
} from './workflow-response.dto.js';
import {
  type ContinueWorkflowRequest,
  type AdvanceWorkflowRequest,
  type DiscussWorkflowRequest,
  type ListExecutionLogsQuery,
  type ListExecutionsQuery,
  type RunWorkflowRequest,
} from './workflow.dto.js';
import {
  getWorkflowExecution,
  listWorkflowExecutionLogs,
  listWorkflowExecutions,
  listWorkflowStates,
  type ExecutionLogsListResponse,
} from './workflow-history.js';
import { closeWorkflowConversation } from './workflow-conversation.js';
import { markCheckpointConfirmed } from './workflow-state-persister.js';
import { executeWorkflowPipeline } from './workflow-executor.js';
import { nextCheckpointStage } from './workflow-interaction-guard.js';
import { buildWorkflowStatus, createExecution } from './workflow-store.js';
import { streamContinue, streamDiscuss, streamRun } from './workflow-stream-actions.js';
import type { WorkflowSse } from './workflow-sse.js';

export type { ExecutionLogsListResponse } from './workflow-history.js';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async run(projectId: string, input: RunWorkflowRequest, stream: WorkflowSse): Promise<void> {
    return streamRun(this.deps(), { projectId, body: input, stream });
  }

  async getStatus(projectId: string): Promise<WorkflowStatusResponse> {
    return buildWorkflowStatus(this.db, this.projects, projectId);
  }

  async continue(
    projectId: string,
    input: ContinueWorkflowRequest,
    stream: WorkflowSse,
  ): Promise<void> {
    return streamContinue(this.deps(), { projectId, body: input, stream });
  }

  async discuss(
    projectId: string,
    input: DiscussWorkflowRequest,
    stream: WorkflowSse,
  ): Promise<void> {
    return streamDiscuss(this.deps(), { projectId, body: input, stream });
  }

  async advance(projectId: string, input: AdvanceWorkflowRequest): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    const status = await this.getStatus(projectId);
    const nextStage = nextCheckpointStage(
      status,
      input.conversation_id,
      project.current_stage as WorkflowStage,
    );
    await markCheckpointConfirmed(this.db, projectId, project.current_stage as WorkflowStage);
    await closeWorkflowConversation(this.db, input.conversation_id);
    const execution = await createExecution(this.db, projectId, nextStage);
    const result = await executeWorkflowPipeline(this.deps(), {
      projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId: input.conversation_id,
      startStage: nextStage,
    });
    return result.status;
  }

  async listStates(projectId: string): Promise<WorkflowStateListResponse> {
    await this.projects.findOrFail(projectId);
    return listWorkflowStates(this.db, projectId);
  }

  async listExecutions(
    projectId: string,
    query: ListExecutionsQuery,
  ): Promise<WorkflowExecutionListResponse> {
    await this.projects.findOrFail(projectId);
    return listWorkflowExecutions(this.db, projectId, query);
  }

  async getExecution(
    projectId: string,
    executionId: string,
  ): Promise<WorkflowExecutionDetailResponse> {
    await this.projects.findOrFail(projectId);
    return getWorkflowExecution(this.db, projectId, executionId);
  }

  async listExecutionLogs(
    projectId: string,
    executionId: string,
    query: ListExecutionLogsQuery,
  ): Promise<ExecutionLogsListResponse> {
    await this.projects.findOrFail(projectId);
    return listWorkflowExecutionLogs(this.db, projectId, executionId, query);
  }

  private deps() {
    return { db: this.db, projects: this.projects, orchestrator: this.orchestrator };
  }
}
