import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/guards/public.decorator.js';
import { HealthService } from './health.service.js';

/**
 * Health endpoint.
 *
 * Contract: `GET /api/v1/health` → `{ "status": "ok" }`
 * Ref: specs/api.spec.md §3 — free-auth endpoint.
 *
 * @internal
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness + readiness probe. Returns service status, DB and LLM provider
   * availability, the running version, and an ISO timestamp.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  async check(): Promise<HealthResponse> {
    return this.health.check();
  }
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  version: string;
  database: 'ok' | 'error';
  llm_providers: Record<string, 'ok' | 'unavailable'>;
}
