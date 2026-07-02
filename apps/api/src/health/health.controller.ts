import { Controller, Get } from '@nestjs/common';

/**
 * Health endpoint.
 *
 * Contract: `GET /api/v1/health` → `{ "status": "ok" }`
 * Ref: specs/api.spec.md §3 — free-auth endpoint.
 *
 * @internal
 */
@Controller('health')
export class HealthController {
  /**
   * Liveness probe. Returns a fixed ok payload.
   */
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
