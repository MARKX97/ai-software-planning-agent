import { Inject, Injectable } from '@nestjs/common';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import {
  agentActionPlanSchema,
  type AgentActionPlan,
  type AgentToolAction,
  type WorkflowContext,
  type WorkflowStage,
} from '@ai-planning/shared';
import { AppConfigService } from '../../../config/app-config.service.js';
import { PrismaService } from '../../../database/database.module.js';
import { AppException } from '../../../common/exception/app-exception.js';
import { ErrorCode } from '../../../common/exception/error-code.js';
import { LLM_ORCHESTRATOR } from '../../../llm/llm.constants.js';
import { AGENT_ACTION_PROMPT, AGENT_ACTION_REPAIR } from '../../../prompts/agent-action.prompt.js';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { syncProjectBudget } from '../workflow-budget.js';
import { logModelCall } from '../stages/model-call-log.js';
import { AgentToolService, type AgentToolRunResult } from './agent-tool.service.js';

@Injectable()
export class AgentActionService {
  @Inject(AgentToolService)
  private readonly tools!: AgentToolService;

  constructor(
    private readonly config: AppConfigService,
    private readonly db: PrismaService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async prepare(input: {
    readonly graphRunId: string;
    readonly context: WorkflowContext;
    readonly stage: WorkflowStage;
  }): Promise<WorkflowContext> {
    if (!this.config.agentActionsEnabled) return clearToolContext(input.context);
    const catalog = await this.catalog(input.context.projectId);
    if (catalog.empty) return clearToolContext(input.context);
    await syncProjectBudget(this.budgetDeps(), input.context.projectId);
    const plan = await this.selectPlan(input.context, input.stage, catalog.text);
    const results = await this.tools.runMany(
      {
        graphRunId: input.graphRunId,
        executionId: input.context.executionId,
        projectId: input.context.projectId,
        stage: input.stage,
      },
      plan.actions,
      (action) => this.checkToolBudget(input.context.projectId, action),
    );
    return withToolContext(input.context, input.stage, results);
  }

  private async selectPlan(
    context: WorkflowContext,
    stage: WorkflowStage,
    catalog: string,
  ): Promise<AgentActionPlan> {
    const prompt = renderPrompt(AGENT_ACTION_PROMPT, {
      stage,
      projectId: context.projectId,
      context: actionContext(context),
      catalog,
    });
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const attemptPrompt = attempt === 1 ? prompt : `${prompt}\n\n${AGENT_ACTION_REPAIR}`;
      const response = await this.orchestrator.callSingle('glm', attemptPrompt, {
        outputSchema: agentActionPlanSchema,
        projectId: context.projectId,
        temperature: 0,
        maxTokens: 1_500,
      });
      await logModelCall(this.db, {
        projectId: context.projectId,
        executionId: context.executionId,
        stage,
        provider: response.provider,
        promptText: attemptPrompt,
        response,
        attemptNumber: attempt,
        promptName: 'agent_action',
      });
      const parsed = agentActionPlanSchema.safeParse(response.structuredOutput);
      if (parsed.success) return parsed.data;
    }
    throw AppException.internal('Agent Action could not be validated', ErrorCode.LLM_ERROR);
  }

  private async catalog(projectId: string): Promise<{ empty: boolean; text: string }> {
    const [sources, artifacts] = await Promise.all([
      this.db.client.knowledgeSource.findMany({
        where: {
          project_id: projectId,
          deleted_at: null,
          status: { in: ['ready', 'ready_with_warnings'] },
        },
        orderBy: { created_at: 'asc' },
        take: 20,
        include: {
          revisions: {
            where: { is_active: true },
            include: {
              documents: {
                orderBy: { logical_path: 'asc' },
                take: 40,
                select: { id: true, logical_path: true, title: true },
              },
            },
          },
        },
      }),
      this.db.client.artifact.findMany({
        where: { project_id: projectId, deleted_at: null },
        orderBy: { created_at: 'asc' },
        select: { id: true, type: true, title: true },
      }),
    ]);
    return {
      empty: sources.length === 0 && artifacts.length === 0,
      text: JSON.stringify({
        sources: sources.map((source) => ({
          id: source.id,
          kind: source.kind,
          name: source.name,
          documents: source.revisions.flatMap((revision) => revision.documents),
        })),
        artifacts,
      }).slice(0, 12_000),
    };
  }

  private checkToolBudget(projectId: string, action: AgentToolAction): Promise<void> {
    const needsEmbedding =
      action.tool === 'searchKnowledge' ||
      (action.tool === 'inspectRepository' && Boolean(action.input.query));
    return needsEmbedding ? syncProjectBudget(this.budgetDeps(), projectId) : Promise.resolve();
  }

  private budgetDeps() {
    return { db: this.db, orchestrator: this.orchestrator };
  }
}

function actionContext(context: WorkflowContext): string {
  return JSON.stringify({
    originalIdea: context.originalIdea,
    confirmedDecisions: context.confirmedDecisions,
    completedStages: Object.keys(context.resultsByStage),
  }).slice(0, 8_000);
}

function clearToolContext(context: WorkflowContext): WorkflowContext {
  return { ...context, agentContext: undefined };
}

function withToolContext(
  context: WorkflowContext,
  stage: WorkflowStage,
  results: readonly AgentToolRunResult[],
): WorkflowContext {
  if (results.length === 0) return clearToolContext(context);
  const agentContext = results
    .map((result) =>
      [`tool=${result.tool}`, `status=${result.status}`, result.summary, result.context]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n')
    .slice(0, 16_000);
  return {
    ...context,
    agentContext,
    conversationHistory: `${context.conversationHistory}\n\n[agent_tool_results stage=${stage}]\n${agentContext}`,
  };
}
