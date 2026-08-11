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
import {
  createPlanningGraph,
  type PlanningGraphState,
  type PrepareGraphStageInput,
} from './planning-graph.js';
import { AgentActionService } from './agent-action.service.js';
import { graphLeaseDeadline, type GraphClaimStatus } from './graph-run-lease.js';
import {
  attachGraphRun,
  completeGraphRun,
  createGraphRun,
  failGraphRun,
  findRetryGraphRun,
} from './agent-graph-run-store.js';

export interface GraphResumeInput {
  readonly graphRunId: string;
  readonly checkpointVersion: number;
  readonly stage: WorkflowStage;
  readonly kind: 'interrupt' | 'retry';
  readonly claimStatus: GraphClaimStatus;
  readonly logicalAttempt: number;
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
    private readonly actions: AgentActionService,
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
    const graph = createPlanningGraph(
      checkpointer,
      (ctx, stage) => runPipelineStage(ctx, deps, stage),
      (prepareInput) => this.prepareStage(prepareInput),
    );
    const run = await this.resolveRun({ context, startStage, resume });
    const graphConfig = { configurable: { thread_id: run.id } };
    try {
      if (resume?.kind === 'interrupt') {
        await graph.invoke(new Command({ resume: { context, stage: resume.stage } }), graphConfig);
      } else if (resume) {
        const checkpoint = await graph.getState(graphConfig);
        const checkpointContext = (checkpoint.values as PlanningGraphState).context;
        await graph.updateState(graphConfig, {
          context: graphContext(
            { ...checkpointContext, executionId: context.executionId },
            run.id,
            resume.logicalAttempt,
          ),
        });
        await graph.invoke(null, graphConfig);
      } else {
        await graph.invoke(initialState(run.id, context, startStage), graphConfig);
      }
      const snapshot = await graph.getState(graphConfig);
      const state = snapshot.values as PlanningGraphState;
      const interrupted = snapshot.next.includes('human_interrupt');
      return completeGraphRun(this.db, { runId: run.id, state, interrupted });
    } catch (error) {
      const failed = await graph.getState(graphConfig).catch(() => null);
      const failedState = failed?.values as PlanningGraphState | undefined;
      await failGraphRun(this.db, {
        runId: run.id,
        cancelled: error instanceof LLMCancelledError,
        state: failedState,
        nextNode: failed?.next[0],
        startStage,
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
      kind: 'interrupt',
      claimStatus: 'interrupted',
      logicalAttempt: 1,
    };
  }

  async retryInput(
    projectId: string,
    projectStatus: 'active' | 'failed',
  ): Promise<GraphResumeInput | undefined> {
    if (!this.enabled) return undefined;
    const now = new Date();
    const claimStatus = projectStatus === 'active' ? 'expired' : 'failed';
    const run = await findRetryGraphRun(this.db, { projectId, claimStatus, now });
    if (!run) return undefined;
    return {
      graphRunId: run.id,
      checkpointVersion: run.checkpoint_version,
      stage: run.current_stage,
      kind: 'retry',
      claimStatus,
      logicalAttempt: run.logical_attempt,
    };
  }

  private async checkpointSaver(): Promise<PostgresSaver> {
    if (!this.checkpointer) {
      this.checkpointer = PostgresSaver.fromConnString(this.config.databaseUrl);
      this.setup = this.checkpointer.setup();
    }
    await this.setup;
    return this.checkpointer;
  }

  private resolveRun(input: {
    context: WorkflowContext;
    startStage: WorkflowStage;
    resume?: GraphResumeInput;
  }) {
    const { context, startStage, resume } = input;
    return resume
      ? attachGraphRun(this.db, {
          runId: resume.graphRunId,
          projectId: context.projectId,
          executionId: context.executionId,
          checkpointVersion: resume.checkpointVersion,
        })
      : createGraphRun(this.db, {
          projectId: context.projectId,
          executionId: context.executionId,
          stage: startStage,
        });
  }

  private async prepareStage(input: PrepareGraphStageInput): Promise<WorkflowContext> {
    const { graphRunId, context, stage, logicalAttempt } = input;
    await this.db.client.graphRun.update({
      where: { id: graphRunId },
      data: {
        current_node: 'choose_action',
        current_stage: stage,
        logical_attempt: logicalAttempt,
        lease_expires_at: graphLeaseDeadline(),
        updated_at: new Date(),
      },
    });
    return this.actions.prepare({ graphRunId, context, stage, logicalAttempt });
  }
}

function initialState(
  graphRunId: string,
  context: WorkflowContext,
  stage: WorkflowStage,
): PlanningGraphState {
  return {
    graphRunId,
    logicalAttempt: 1,
    context: graphContext(context, graphRunId, 1),
    stage,
    nextStage: stage,
    currentNode: 'start',
    waitingFor: null,
  };
}

function graphContext(
  context: WorkflowContext,
  graphRunId: string,
  logicalAttempt: number,
): WorkflowContext {
  return { ...context, graphRunId, logicalAttempt };
}
