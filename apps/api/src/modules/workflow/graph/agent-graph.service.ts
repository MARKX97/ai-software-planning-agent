import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LLMCancelledError } from '@ai-planning/llm-orchestrator';
import { Command } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { WorkflowStage, type WorkflowContext } from '@ai-planning/shared';
import { AppConfigService } from '../../../config/app-config.service.js';
import { PrismaService } from '../../../database/database.module.js';
import { AppException } from '../../../common/exception/app-exception.js';
import { ErrorCode } from '../../../common/exception/error-code.js';
import { runPipelineStage, type PipelineRunDeps } from '../workflow-pipeline-runner.js';
import { createPlanningGraph, type PlanningGraphState } from './planning-graph.js';

export interface GraphResumeInput {
  readonly graphRunId: string;
  readonly checkpointVersion: number;
  readonly stage: WorkflowStage;
}

export interface GraphExecutionInput {
  readonly context: WorkflowContext;
  readonly deps: PipelineRunDeps;
  readonly startStage: WorkflowStage;
  readonly resume?: GraphResumeInput;
}

@Injectable()
export class AgentGraphService implements OnModuleInit, OnModuleDestroy {
  private checkpointer?: PostgresSaver;
  private setup?: Promise<void>;

  constructor(
    private readonly config: AppConfigService,
    private readonly db: PrismaService,
  ) {}

  get enabled(): boolean {
    return this.config.workflowRunner === 'graph';
  }

  async onModuleInit(): Promise<void> {
    if (this.enabled) await this.checkpointSaver();
  }

  async execute(input: GraphExecutionInput): Promise<WorkflowStage> {
    const { context, deps, startStage, resume } = input;
    const checkpointer = await this.checkpointSaver();
    const graph = createPlanningGraph(checkpointer, (ctx, stage) =>
      runPipelineStage(ctx, deps, stage),
    );
    const run = resume
      ? await this.attachResume(context.projectId, context.executionId, resume)
      : await this.createRun(context.projectId, context.executionId, startStage);
    const graphConfig = { configurable: { thread_id: run.id } };
    try {
      if (resume) {
        await graph.invoke(new Command({ resume: { context, stage: resume.stage } }), graphConfig);
      } else {
        await graph.invoke(initialState(run.id, context, startStage), graphConfig);
      }
      const snapshot = await graph.getState(graphConfig);
      const state = snapshot.values as PlanningGraphState;
      const interrupted = snapshot.next.includes('human_interrupt');
      await this.db.client.graphRun.update({
        where: { id: run.id },
        data: {
          status: interrupted ? 'interrupted' : 'completed',
          current_node: interrupted ? state.currentNode : 'end',
          current_stage: interrupted
            ? (state.currentNode as WorkflowStage)
            : WorkflowStage.COMPLETED,
          waiting_for: interrupted ? state.waitingFor : null,
          checkpoint_version: { increment: 1 },
          completed_at: interrupted ? null : new Date(),
          updated_at: new Date(),
        },
      });
      return interrupted ? (state.currentNode as WorkflowStage) : WorkflowStage.COMPLETED;
    } catch (error) {
      await this.db.client.graphRun.update({
        where: { id: run.id },
        data: {
          status: error instanceof LLMCancelledError ? 'cancelled' : 'failed',
          current_node: error instanceof LLMCancelledError ? 'cancelled' : 'failed',
          updated_at: new Date(),
        },
      });
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.checkpointer?.end();
  }

  resumeInput(input: {
    graphRunId?: string;
    checkpointVersion?: number;
    stage: WorkflowStage;
  }): GraphResumeInput | undefined {
    if (!this.enabled) return undefined;
    if (!input.graphRunId || input.checkpointVersion === undefined) {
      throw AppException.badRequest(ErrorCode.INVALID_INPUT, 'Graph checkpoint is required');
    }
    return {
      graphRunId: input.graphRunId,
      checkpointVersion: input.checkpointVersion,
      stage: input.stage,
    };
  }

  async reserveResume(projectId: string, input: GraphResumeInput): Promise<void> {
    const claimed = await this.db.client.graphRun.updateMany({
      where: {
        id: input.graphRunId,
        project_id: projectId,
        status: 'interrupted',
        checkpoint_version: input.checkpointVersion,
      },
      data: { status: 'running', updated_at: new Date() },
    });
    if (claimed.count !== 1) {
      throw AppException.conflict(ErrorCode.INVALID_STAGE_TRANSITION, 'Graph checkpoint is stale');
    }
  }

  private async checkpointSaver(): Promise<PostgresSaver> {
    if (!this.checkpointer) {
      this.checkpointer = PostgresSaver.fromConnString(this.config.databaseUrl);
      this.setup = this.checkpointer.setup();
    }
    await this.setup;
    return this.checkpointer;
  }

  private createRun(projectId: string, executionId: string, stage: WorkflowStage) {
    return this.db.client.graphRun.create({
      data: {
        project_id: projectId,
        execution_id: executionId,
        status: 'running',
        current_node: 'start',
        current_stage: stage,
        updated_at: new Date(),
      },
    });
  }

  private async attachResume(projectId: string, executionId: string, input: GraphResumeInput) {
    const attached = await this.db.client.graphRun.updateMany({
      where: {
        id: input.graphRunId,
        project_id: projectId,
        status: 'running',
        checkpoint_version: input.checkpointVersion,
      },
      data: { execution_id: executionId, updated_at: new Date() },
    });
    if (attached.count !== 1) {
      throw AppException.conflict(ErrorCode.INVALID_STAGE_TRANSITION, 'Graph checkpoint is stale');
    }
    return { id: input.graphRunId };
  }
}

function initialState(
  graphRunId: string,
  context: WorkflowContext,
  stage: WorkflowStage,
): PlanningGraphState {
  return { graphRunId, context, stage, nextStage: stage, currentNode: 'start', waitingFor: null };
}
