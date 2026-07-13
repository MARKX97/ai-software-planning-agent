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
import { assertCanContinueWorkflow, assertWorkflowNotRunning } from './workflow-guards.js';
import {
  getWorkflowExecution,
  listWorkflowExecutionLogs,
  listWorkflowExecutions,
  listWorkflowStates,
  type ExecutionLogsListResponse,
} from './workflow-history.js';
import {
  appendAgentReply,
  appendUserReply,
  closeWorkflowConversation,
  resolveWorkflowConversation,
} from './workflow-conversation.js';
import { CheckpointDiscussionStage } from './stages/checkpoint-discussion.stage.js';
import { markCheckpointConfirmed } from './workflow-state-persister.js';
import { buildWorkflowContext, executeWorkflowPipeline } from './workflow-executor.js';
import { assertWorkflowInteraction, nextCheckpointStage } from './workflow-interaction-guard.js';
import {
  buildWorkflowStatus,
  createExecution,
  markExecutionComplete,
  markExecutionFailed,
  markProjectStarted,
  updateProjectStage,
} from './workflow-store.js';

export type { ExecutionLogsListResponse } from './workflow-history.js';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async run(projectId: string, input: RunWorkflowRequest): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    assertWorkflowNotRunning(project);
    const conversationId = await resolveWorkflowConversation(
      this.db,
      projectId,
      input.conversation_id,
    );
    const execution = await createExecution(this.db, projectId);
    await markProjectStarted(this.db, projectId);
    return executeWorkflowPipeline(this.deps(), {
      projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId,
    });
  }

  async getStatus(projectId: string): Promise<WorkflowStatusResponse> {
    return buildWorkflowStatus(this.db, this.projects, projectId);
  }

  async continue(
    projectId: string,
    input: ContinueWorkflowRequest,
  ): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    const status = await this.getStatus(projectId);
    await resolveWorkflowConversation(this.db, projectId, input.conversation_id);
    assertCanContinueWorkflow(project);
    assertWorkflowInteraction(status, input.conversation_id, 'reply');
    await appendUserReply(this.db, input.conversation_id, input.message);
    const execution = await createExecution(this.db, projectId);
    await updateProjectStage(this.db, projectId, WorkflowStage.REQUIREMENT_ANALYSIS);
    return executeWorkflowPipeline(this.deps(), {
      projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId: input.conversation_id,
      startStage: WorkflowStage.REQUIREMENT_ANALYSIS,
    });
  }

  async discuss(projectId: string, input: DiscussWorkflowRequest): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    const status = await this.getStatus(projectId);
    await resolveWorkflowConversation(this.db, projectId, input.conversation_id);
    assertWorkflowInteraction(status, input.conversation_id);
    await appendUserReply(this.db, input.conversation_id, input.message);
    const execution = await createExecution(
      this.db,
      projectId,
      project.current_stage as WorkflowStage,
    );
    try {
      const ctx = await buildWorkflowContext(this.db, {
        projectId,
        executionId: execution.id,
        originalIdea: project.original_idea,
        conversationId: input.conversation_id,
      });
      const reply = await new CheckpointDiscussionStage({
        db: this.db,
        orchestrator: this.orchestrator,
        dataDir: this.projects.dataDir(),
      }).execute(ctx, project.current_stage as WorkflowStage);
      await appendAgentReply(
        this.db,
        input.conversation_id,
        reply,
        project.current_stage as WorkflowStage,
      );
      await markExecutionComplete(this.db, execution.id);
    } catch (error) {
      await markExecutionFailed(this.db, execution.id, error);
      throw error;
    }
    return this.getStatus(projectId);
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
    return executeWorkflowPipeline(this.deps(), {
      projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId: input.conversation_id,
      startStage: nextStage,
    });
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
