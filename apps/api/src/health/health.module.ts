import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

/**
 * Health check module.
 * @internal
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
