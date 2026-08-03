import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { EmbeddingProvider } from './embedding.provider.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeIndexStore } from './knowledge-index.store.js';
import { KnowledgeIndexerService } from './knowledge-indexer.service.js';
import { KnowledgeParser } from './knowledge-parser.js';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service.js';
import { KnowledgeSearchController } from './knowledge-search.controller.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  imports: [ProjectsModule],
  controllers: [KnowledgeController, KnowledgeSearchController],
  providers: [
    EmbeddingProvider,
    KnowledgeIndexStore,
    KnowledgeIndexerService,
    KnowledgeParser,
    KnowledgeRetrievalService,
    KnowledgeService,
  ],
  exports: [KnowledgeRetrievalService],
})
export class KnowledgeModule {}
