import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { EmbeddingError, EmbeddingProvider } from './embedding.provider.js';
import type { EmbeddedChunk } from './knowledge-chunk-writer.js';
import { KnowledgeIndexStore, type IndexIdentity } from './knowledge-index.store.js';
import {
  KnowledgeParser,
  type ParsedKnowledgeChunk,
  type ParsedKnowledgeDocument,
  type UploadedKnowledgeFile,
} from './knowledge-parser.js';

const EMBEDDING_BATCH_SIZE = 32;
const INDEXER_VERSION = 'p0-v1';

@Injectable()
export class KnowledgeIndexerService {
  private readonly logger = new Logger(KnowledgeIndexerService.name);

  constructor(
    private readonly store: KnowledgeIndexStore,
    private readonly embeddings: EmbeddingProvider,
    private readonly parser: KnowledgeParser,
  ) {}

  parse(file: UploadedKnowledgeFile): Promise<ParsedKnowledgeDocument> {
    return this.parser.parse(file);
  }

  async index(
    projectId: string,
    sourceId: string,
    document: ParsedKnowledgeDocument,
  ): Promise<void> {
    const identity = this.identity();
    const revision = await this.store.begin({
      projectId,
      sourceId,
      contentHash: document.contentHash,
      identity,
    });
    if (!revision) return;
    const startedAt = Date.now();
    try {
      const embedded = await this.embed(document.chunks);
      if (embedded.items.length === 0) {
        throw embedded.lastError ?? new EmbeddingError('EMBEDDING_FAILED');
      }
      await this.store.complete({
        sourceId,
        revisionId: revision.id,
        document,
        chunks: embedded.items,
        warningCount: embedded.warningCount,
        indexerVersion: INDEXER_VERSION,
      });
      this.log({
        projectId,
        sourceId,
        revision: revision.number,
        chunks: embedded.items.length,
        startedAt,
      });
    } catch (error) {
      await this.store.fail(sourceId, revision.id, error);
      this.log({ projectId, sourceId, revision: revision.number, result: 'failed', startedAt });
      throw AppException.internal('Knowledge indexing failed', ErrorCode.KNOWLEDGE_INDEXING_FAILED);
    }
  }

  private async embed(
    chunks: readonly ParsedKnowledgeChunk[],
  ): Promise<{ items: EmbeddedChunk[]; warningCount: number; lastError?: Error }> {
    const items: EmbeddedChunk[] = [];
    let warningCount = 0;
    let lastError: Error | undefined;
    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      try {
        const vectors = await this.embeddings.embedDocuments(batch.map((chunk) => chunk.content));
        batch.forEach((chunk, index) => items.push({ chunk, embedding: vectors[index] ?? [] }));
      } catch (error) {
        warningCount += batch.length;
        lastError = error instanceof Error ? error : new EmbeddingError('EMBEDDING_FAILED');
      }
    }
    return { items, warningCount, lastError };
  }

  private identity(): IndexIdentity {
    return {
      model: this.embeddings.model,
      dimensions: this.embeddings.dimensions,
      version: INDEXER_VERSION,
    };
  }

  private log(input: {
    projectId: string;
    sourceId: string;
    revision: number;
    startedAt: number;
    chunks?: number;
    result?: 'failed';
  }): void {
    const { startedAt, ...details } = input;
    const entry = { ...details, durationMs: Date.now() - startedAt };
    if (input.result === 'failed') this.logger.warn(entry);
    else this.logger.log(entry);
  }
}
