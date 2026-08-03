import { HttpStatus, Injectable } from '@nestjs/common';
import { searchKnowledgeChunks, type KnowledgeSearchCandidate } from '@ai-planning/database';
import type {
  EvidenceCitation,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
} from '@ai-planning/shared';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { redactSensitiveText } from '../../common/security/sensitive-text.js';
import { ProjectsService } from '../projects/projects.service.js';
import { EmbeddingProvider } from './embedding.provider.js';

const EXCERPT_CHARACTERS = 800;

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    private readonly embeddings: EmbeddingProvider,
  ) {}

  async search(projectId: string, input: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> {
    await this.projects.findOrFail(projectId);
    if (!this.embeddings.retrievalEnabled || !(await this.hasSources(projectId, input))) {
      return emptySearch();
    }
    try {
      const [queryVector] = await this.embeddings.embedDocuments([input.query]);
      if (!queryVector) return emptySearch();
      const rows = await searchKnowledgeChunks(this.db.client, {
        projectId,
        queryText: input.query,
        queryVector,
        embeddingModel: this.embeddings.model,
        embeddingDimensions: this.embeddings.dimensions,
        sourceIds: input.source_ids,
        topK: input.top_k,
      });
      const items = rows.map(toEvidenceCitation);
      return { items, insufficient_evidence: items.length === 0 };
    } catch {
      throw new AppException(
        ErrorCode.KNOWLEDGE_UNAVAILABLE,
        'Knowledge retrieval is temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async hasSources(projectId: string, input: KnowledgeSearchRequest): Promise<boolean> {
    const count = await this.db.client.knowledgeSource.count({
      where: {
        project_id: projectId,
        deleted_at: null,
        status: { in: ['ready', 'ready_with_warnings'] },
        ...(input.source_ids?.length ? { id: { in: input.source_ids } } : {}),
      },
    });
    return count > 0;
  }
}

function toEvidenceCitation(row: KnowledgeSearchCandidate): EvidenceCitation {
  return {
    sourceId: row.sourceId,
    documentId: row.documentId,
    chunkId: row.chunkId,
    title: row.title,
    locator: locator(row),
    excerpt: redactSensitiveText(row.content).trim().slice(0, EXCERPT_CHARACTERS),
    contentHash: row.contentHash,
  };
}

function locator(row: KnowledgeSearchCandidate): string {
  if (row.pageNumber) return `${row.logicalPath}:page-${row.pageNumber}`;
  if (row.lineStart && row.lineEnd) {
    const lines = `${row.logicalPath}:L${row.lineStart}-L${row.lineEnd}`;
    return row.repositoryCommit ? `${lines}@${row.repositoryCommit}` : lines;
  }
  return row.logicalPath;
}

function emptySearch(): KnowledgeSearchResponse {
  return { items: [], insufficient_evidence: true };
}
