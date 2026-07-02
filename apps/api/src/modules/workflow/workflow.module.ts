import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkflowService } from './workflow.service.js';

/** @internal */
@Module({
  imports: [ProjectsModule, UsageModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
