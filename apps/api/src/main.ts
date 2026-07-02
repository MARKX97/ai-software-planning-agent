import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import type { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Bootstrap the NestJS API server.
 *
 * @internal
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  // Global prefix for all routes per specs/api.spec.md §2.
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(config.port);
  console.log(`API listening on http://localhost:${config.port}/api/v1`);
}

void bootstrap();
