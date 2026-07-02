import { Injectable } from '@nestjs/common';
import type { Project, WorkflowExecution } from '@ai-planning/database';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { toModelExecutionLogResponse, type ModelExecutionLogResponse } from '../usage/usage.dto.js';
import {
  buildStatusFromProject,
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

const RUNNING_STAGES = new Set([
  'requirement_analysis',
  'requirement_clarification',
  'multi_model_analysis',
  'requirement_synthesis',
  'feasibility_analysis',
  'risk_analysis',
  'mvp_compression',
  'platform_recommendation',
  'planning_generation',
]);

export interface ExecutionLogsListResponse {
  items: ModelExecutionLogResponse[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Workflow service — Phase 3 STUB. Does NOT run the real pipeline.
 * @internal
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async run(projectId: string, _input: RunWorkflowRequest): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    this.assertNotRunning(project);
    // STUB: create a placeholder execution without mutating project stage.
    await this.db.client.workflowExecution.create({
      data: {
        project_id: projectId,
        stage: 'requirement_analysis',
        status: 'success',
        started_at: new Date(),
        retry_count: 0,
      },
    });
    return buildStatusFromProject(project, 0);
  }

  async getStatus(projectId: string): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    const completedStages = await this.countCompletedStages(projectId);
    return buildStatusFromProject(project, completedStages);
  }

  async continue(
    projectId: string,
    input: ContinueWorkflowRequest,
  ): Promise<WorkflowStatusResponse> {
    const project = await this.projects.findOrFail(projectId);
    await this.findConversationOrFail(projectId, input.conversation_id);
    if (project.current_stage !== 'requirement_clarification') {
      throw AppException.conflict(
        ErrorCode.WORKFLOW_STAGE_NOT_CLARIFICATION,
        `Cannot continue workflow from stage '${project.current_stage}'`,
        { current_stage: project.current_stage, expected_stage: 'requirement_clarification' },
      );
    }
    // STUB: do NOT advance the real workflow.
    const completedStages = await this.countCompletedStages(projectId);
    return buildStatusFromProject(project, completedStages);
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
    const counts = await this.countModelLogs(rows);
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
    const execution = await this.findExecutionOrFail(projectId, executionId);
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
    await this.findExecutionOrFail(projectId, executionId);
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

  private async findExecutionOrFail(
    projectId: string,
    executionId: string,
  ): Promise<WorkflowExecution> {
    const execution = await this.db.client.workflowExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution || execution.project_id !== projectId) {
      throw AppException.notFound(
        ErrorCode.EXECUTION_NOT_FOUND,
        `Execution '${executionId}' not found`,
      );
    }
    return execution;
  }

  private async findConversationOrFail(projectId: string, conversationId: string): Promise<void> {
    const conversation = await this.db.client.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.project_id !== projectId) {
      throw AppException.notFound(
        ErrorCode.CONVERSATION_NOT_FOUND,
        `Conversation '${conversationId}' not found in project '${projectId}'`,
      );
    }
  }

  private assertNotRunning(project: Project): void {
    if (project.status === 'active' && RUNNING_STAGES.has(project.current_stage)) {
      throw AppException.conflict(
        ErrorCode.WORKFLOW_ALREADY_RUNNING,
        'Workflow is already running for this project',
      );
    }
  }

  private async countCompletedStages(projectId: string): Promise<number> {
    return this.db.client.workflowState.count({
      where: { project_id: projectId, status: 'completed' },
    });
  }

  private async countModelLogs(rows: WorkflowExecution[]): Promise<number[]> {
    if (rows.length === 0) return [];
    const grouped = await this.db.client.modelExecutionLog.groupBy({
      by: ['execution_id'],
      where: { execution_id: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of grouped) {
      if (g.execution_id !== null) map.set(g.execution_id, g._count._all);
    }
    return rows.map((r) => map.get(r.id) ?? 0);
  }
}
