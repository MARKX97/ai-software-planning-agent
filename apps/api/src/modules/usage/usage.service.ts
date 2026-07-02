import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.module.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  toModelExecutionLogDetail,
  toModelExecutionLogResponse,
  toTokenUsageResponse,
  type ListLogsQuery,
  type ModelExecutionLogDetailResponse,
  type ModelExecutionLogListResponse,
  type ProviderBreakdown,
  type StageBreakdown,
  type TokenUsageDetailResponse,
  type TokenUsageQuery,
} from './usage.dto.js';
import type { ModelExecutionLog } from '@ai-planning/database';

interface ProviderAgg {
  call_count: number;
  success_count: number;
  failed_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  latency_sum: number;
  latency_count: number;
}

interface StageAgg {
  call_count: number;
  total_cost: number;
  latency_sum: number;
  latency_count: number;
}

/**
 * Usage service — token/cost aggregates + model execution log queries.
 * @internal
 */
@Injectable()
export class UsageService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: AppConfigService,
    private readonly projects: ProjectsService,
  ) {}

  async getTokenUsageDetail(query: TokenUsageQuery): Promise<TokenUsageDetailResponse> {
    await this.projects.findOrFail(query.project_id);
    const usage = await this.db.client.tokenUsage.findUnique({
      where: { project_id: query.project_id },
    });
    const base = toTokenUsageResponse(query.project_id, usage);
    const logs = await this.db.client.modelExecutionLog.findMany({
      where: { project_id: query.project_id },
    });
    const { byProvider, byStage } = this.aggregate(logs);
    const maxCost = this.config.costLimitPerProject;
    const remaining = Math.max(0, maxCost - base.total_cost);
    return {
      ...base,
      by_provider: byProvider,
      by_stage: byStage,
      cost_limit: {
        max_cost_per_project: maxCost,
        remaining,
        alert_triggered: base.total_cost >= maxCost * 0.8,
      },
    };
  }

  async listLogs(projectId: string, query: ListLogsQuery): Promise<ModelExecutionLogListResponse> {
    await this.projects.findOrFail(projectId);
    const where = this.buildWhere(projectId, query);
    const [items, total] = await Promise.all([
      this.db.client.modelExecutionLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.client.modelExecutionLog.count({ where }),
    ]);
    return {
      items: items.map(toModelExecutionLogResponse),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async getLog(projectId: string, logId: string): Promise<ModelExecutionLogDetailResponse> {
    await this.projects.findOrFail(projectId);
    const log = await this.db.client.modelExecutionLog.findUnique({ where: { id: logId } });
    if (!log || log.project_id !== projectId) {
      throw AppException.notFound(ErrorCode.EXECUTION_NOT_FOUND, `Log '${logId}' not found`);
    }
    return toModelExecutionLogDetail(log);
  }

  private aggregate(logs: ModelExecutionLog[]): {
    byProvider: ProviderBreakdown[];
    byStage: StageBreakdown[];
  } {
    const providers = new Map<string, ProviderAgg>();
    const stages = new Map<string, StageAgg>();
    for (const log of logs) {
      const p = providers.get(log.provider_name) ?? this.blankProvider();
      p.call_count += 1;
      p.total_input_tokens += log.input_tokens;
      p.total_output_tokens += log.output_tokens;
      p.total_cost += Number(log.cost_total);
      if (log.status === 'success') p.success_count += 1;
      if (log.status === 'failed') p.failed_count += 1;
      if (log.latency_ms != null) {
        p.latency_sum += log.latency_ms;
        p.latency_count += 1;
      }
      providers.set(log.provider_name, p);

      const s = stages.get(log.stage) ?? this.blankStage();
      s.call_count += 1;
      s.total_cost += Number(log.cost_total);
      if (log.latency_ms != null) {
        s.latency_sum += log.latency_ms;
        s.latency_count += 1;
      }
      stages.set(log.stage, s);
    }
    return {
      byProvider: [...providers.entries()].map(([provider_name, agg]) =>
        this.toProviderBreakdown(provider_name, agg),
      ),
      byStage: [...stages.entries()].map(([stage, agg]) => this.toStageBreakdown(stage, agg)),
    };
  }

  private blankProvider(): ProviderAgg {
    return {
      call_count: 0,
      success_count: 0,
      failed_count: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost: 0,
      latency_sum: 0,
      latency_count: 0,
    };
  }

  private blankStage(): StageAgg {
    return { call_count: 0, total_cost: 0, latency_sum: 0, latency_count: 0 };
  }

  private toProviderBreakdown(provider_name: string, agg: ProviderAgg): ProviderBreakdown {
    const rounded = Math.round(agg.total_cost * 1000) / 1000;
    return {
      provider_name,
      call_count: agg.call_count,
      success_count: agg.success_count,
      failed_count: agg.failed_count,
      total_input_tokens: agg.total_input_tokens,
      total_output_tokens: agg.total_output_tokens,
      total_cost: rounded,
      avg_latency_ms:
        agg.latency_count > 0 ? Math.round(agg.latency_sum / agg.latency_count) : null,
    };
  }

  private toStageBreakdown(stage: string, agg: StageAgg): StageBreakdown {
    const rounded = Math.round(agg.total_cost * 1000) / 1000;
    return {
      stage,
      call_count: agg.call_count,
      total_cost: rounded,
      avg_latency_ms:
        agg.latency_count > 0 ? Math.round(agg.latency_sum / agg.latency_count) : null,
    };
  }

  private buildWhere(projectId: string, query: ListLogsQuery) {
    return {
      project_id: projectId,
      ...(query.provider_name ? { provider_name: query.provider_name } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
  }
}
