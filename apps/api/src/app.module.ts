import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { ModelsModule } from './modules/models/models.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';
import { ConversationsModule } from './modules/conversations/conversations.module.js';
import { ArtifactsModule } from './modules/artifacts/artifacts.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { AppController } from './app.controller.js';

/**
 * Root application module.
 * @internal
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    ModelsModule,
    ProjectsModule,
    WorkflowModule,
    ConversationsModule,
    ArtifactsModule,
    ExportsModule,
    UsageModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
