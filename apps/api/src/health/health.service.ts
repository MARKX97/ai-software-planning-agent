import { Inject, Injectable } from '@nestjs/common';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { PrismaService } from '../database/database.module.js';
import { AppConfigService } from '../config/app-config.service.js';
import { LLM_ORCHESTRATOR } from '../llm/llm.constants.js';
import type { HealthResponse } from './health.controller.js';

/**
 * Aggregates DB and LLM provider availability for the health check.
 * @internal
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: AppConfigService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, llm] = await Promise.all([this.checkDatabase(), this.checkLlm()]);
    const degraded = database === 'error' || Object.values(llm).some((v) => v === 'unavailable');
    return {
      status: degraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      version: this.config.version ?? '1.0.0',
      database,
      llm_providers: llm,
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.db.client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkLlm(): Promise<Record<string, 'ok' | 'unavailable'>> {
    const health = await this.orchestrator.healthCheck();
    const result: Record<string, 'ok' | 'unavailable'> = {};
    for (const [name, ok] of Object.entries(health)) {
      result[name] = ok ? 'ok' : 'unavailable';
    }
    return result;
  }
}
