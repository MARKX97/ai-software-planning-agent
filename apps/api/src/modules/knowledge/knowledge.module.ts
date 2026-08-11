import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { EmbeddingProvider } from './embedding.provider.js';
import { GitHubRepositoryClient } from './github-repository.client.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeIndexStore } from './knowledge-index.store.js';
import { KnowledgeIndexerService } from './knowledge-indexer.service.js';
import { KnowledgeParser } from './knowledge-parser.js';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service.js';
import { KnowledgeSearchController } from './knowledge-search.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeSourceProcessor } from './knowledge-source-processor.js';
import { WorkflowRateLimitGuard } from '../../common/guards/workflow-rate-limit.guard.js';
import { KnowledgeWriteAdmissionInterceptor } from './knowledge-write-admission.interceptor.js';

@Module({
  imports: [ProjectsModule],
  controllers: [KnowledgeController, KnowledgeSearchController],
  providers: [
    EmbeddingProvider,
    GitHubRepositoryClient,
    KnowledgeIndexStore,
    KnowledgeIndexerService,
    KnowledgeParser,
    KnowledgeRetrievalService,
    KnowledgeService,
    KnowledgeSourceProcessor,
    WorkflowRateLimitGuard,
    KnowledgeWriteAdmissionInterceptor,
  ],
  exports: [KnowledgeRetrievalService],
})
export class KnowledgeModule {}
