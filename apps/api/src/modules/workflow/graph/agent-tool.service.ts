import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  agentToolActionSchema,
  type AgentToolAction,
  type WorkflowStage,
} from '@ai-planning/shared';
import { PrismaService } from '../../../database/database.module.js';
import { AppException } from '../../../common/exception/app-exception.js';
import { ErrorCode } from '../../../common/exception/error-code.js';
import { redactSensitiveText } from '../../../common/security/sensitive-text.js';
import { KnowledgeRetrievalService } from '../../knowledge/knowledge-retrieval.service.js';
import { readAgentTool, type ToolReadResult } from './agent-tool-readers.js';

export interface AgentToolRunContext {
  readonly graphRunId: string;
  readonly executionId: string;
  readonly projectId: string;
  readonly stage: WorkflowStage;
}

export interface AgentToolRunResult extends ToolReadResult {
  readonly tool: string;
  readonly status: 'success' | 'failed' | 'rejected';
  readonly errorCode?: string;
}

interface AgentToolCall {
  readonly context: AgentToolRunContext;
  readonly callNumber: number;
  readonly beforeRead?: (action: AgentToolAction) => Promise<void>;
}

interface RejectedToolCall {
  readonly tool: string;
  readonly action: unknown;
  readonly errorCode: string;
}

@Injectable()
export class AgentToolService {
  @Inject(KnowledgeRetrievalService)
  private readonly knowledge!: KnowledgeRetrievalService;

  constructor(private readonly db: PrismaService) {}

  async runMany(
    context: AgentToolRunContext,
    actions: readonly unknown[],
    beforeRead?: (action: AgentToolAction) => Promise<void>,
  ): Promise<AgentToolRunResult[]> {
    const results: AgentToolRunResult[] = [];
    for (let index = 0; index < actions.length; index += 1) {
      results.push(
        await this.execute({ context, callNumber: index + 1, beforeRead }, actions[index]),
      );
    }
    return results;
  }

  async execute(call: AgentToolCall, rawAction: unknown): Promise<AgentToolRunResult> {
    const tool = toolName(rawAction);
    const parsed = agentToolActionSchema.safeParse(rawAction);
    if (call.callNumber > 3) {
      return this.reject(call, {
        tool,
        action: rawAction,
        errorCode: ErrorCode.TOOL_LIMIT_EXCEEDED,
      });
    }
    if (!parsed.success) {
      return this.reject(call, { tool, action: rawAction, errorCode: ErrorCode.TOOL_REJECTED });
    }
    if (parsed.data.input.projectId !== call.context.projectId) {
      return this.reject(call, {
        tool: parsed.data.tool,
        action: parsed.data,
        errorCode: ErrorCode.TOOL_PROJECT_MISMATCH,
      });
    }
    return this.run(call, parsed.data);
  }

  private async run(call: AgentToolCall, action: AgentToolAction): Promise<AgentToolRunResult> {
    const reserved = await this.reserve(call, action.tool, action);
    const replay = storedResult(reserved);
    if (reserved.status !== 'running' && replay) return replay;
    const startedAt = Date.now();
    try {
      await call.beforeRead?.(action);
      const result = await readAgentTool(
        { db: this.db, knowledge: this.knowledge },
        call.context.projectId,
        action,
      );
      const output = { ...result, tool: action.tool, status: 'success' as const };
      await this.finish(reserved.id, output, Date.now() - startedAt);
      return output;
    } catch (error) {
      const output = failedResult(action.tool, error);
      await this.finish(reserved.id, output, Date.now() - startedAt);
      return output;
    }
  }

  private async reject(
    call: AgentToolCall,
    rejection: RejectedToolCall,
  ): Promise<AgentToolRunResult> {
    const row = await this.reserve(call, rejection.tool, rejection.action);
    const replay = storedResult(row);
    if (row.status !== 'running' && replay) return replay;
    const result: AgentToolRunResult = {
      tool: rejection.tool,
      status: 'rejected',
      resultCount: 0,
      summary: 'Tool 调用已拒绝',
      context: '',
      errorCode: rejection.errorCode,
    };
    await this.finish(row.id, result, 0);
    return result;
  }

  private reserve(call: AgentToolCall, tool: string, action: unknown) {
    const id = randomUUID();
    return this.db.client.toolStep.upsert({
      where: {
        graph_run_id_stage_call_number: {
          graph_run_id: call.context.graphRunId,
          stage: call.context.stage,
          call_number: call.callNumber,
        },
      },
      create: {
        id,
        graph_run_id: call.context.graphRunId,
        execution_id: call.context.executionId,
        stage: call.context.stage,
        node: 'choose_action',
        tool: tool.slice(0, 64),
        call_number: call.callNumber,
        status: 'running',
        arguments_json: argumentSummary(action) as never,
        updated_at: new Date(),
      },
      update: {},
    });
  }

  private async finish(id: string, result: AgentToolRunResult, durationMs: number): Promise<void> {
    await this.db.client.toolStep.update({
      where: { id },
      data: {
        status: result.status,
        result_json: result as never,
        result_count: result.resultCount,
        duration_ms: durationMs,
        error_code: result.errorCode,
        updated_at: new Date(),
      },
    });
  }
}

function failedResult(tool: string, error: unknown): AgentToolRunResult {
  const errorCode = error instanceof AppException ? error.code : ErrorCode.KNOWLEDGE_UNAVAILABLE;
  return {
    tool,
    status: 'failed',
    resultCount: 0,
    summary: 'Tool 暂时不可用',
    context: '',
    errorCode,
  };
}

function storedResult(row: { result_json: unknown }): AgentToolRunResult | null {
  const value = row.result_json;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as AgentToolRunResult;
}

function toolName(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const tool = (value as Record<string, unknown>)['tool'];
  return typeof tool === 'string' ? redactSensitiveText(tool).slice(0, 64) : 'invalid';
}

function argumentSummary(value: unknown): Record<string, unknown> {
  const text = redactSensitiveText(JSON.stringify(value)).slice(0, 1_000);
  return { redacted: text };
}
