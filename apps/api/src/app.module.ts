import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { AppController } from './app.controller.js';

/**
 * Root application module.
 *
 * @internal
 */
@Module({
  imports: [ConfigModule, HealthModule],
  controllers: [AppController],
})
export class AppModule {}
