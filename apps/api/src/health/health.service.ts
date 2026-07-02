import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/database.module.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { HealthResponse } from './health.controller.js';

/**
 * Aggregates DB and (stubbed) LLM provider availability for the health check.
 * Real LLM provider probing lands in later phases.
 * @internal
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: AppConfigService,
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
    // Phase 3: configs present → "ok"; real probing deferred.
    const providers = ['deepseek', 'glm', 'minimax'];
    const result: Record<string, 'ok' | 'unavailable'> = {};
    for (const p of providers) {
      result[p] = this.config.baishanApiKey ? 'ok' : 'unavailable';
    }
    return result;
  }
}
