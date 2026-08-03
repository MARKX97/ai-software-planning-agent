import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkflowService } from './workflow.service.js';
import { WorkflowRateLimitGuard } from '../../common/guards/workflow-rate-limit.guard.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { AgentGraphService } from './graph/agent-graph.service.js';

/** @internal */
@Module({
  imports: [ProjectsModule, UsageModule, KnowledgeModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRateLimitGuard, AgentGraphService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
