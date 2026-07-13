import { Logger, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { HttpExceptionFilter } from './common/exception/http-exception.filter.js';

/**
 * Bootstrap the NestJS API server.
 *
 * @internal
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);

  // Global prefix for all routes per specs/api.spec.md §2.
  app.setGlobalPrefix('api/v1');

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());

  await setupSwagger(app);

  await app.listen(config.port);
  logger.log(`API listening on http://localhost:${config.port}/api/v1`);
  logger.log(`Swagger UI at http://localhost:${config.port}/api/docs`);
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('AI Software Planning Agent API')
    .setDescription('REST API for the AI software planning agent. Contract: contracts/openapi.yaml')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}

void bootstrap();
