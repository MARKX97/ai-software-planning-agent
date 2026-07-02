import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/**
 * Health check module.
 *
 * @internal
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
