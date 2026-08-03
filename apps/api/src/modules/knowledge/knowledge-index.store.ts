import { Injectable } from '@nestjs/common';
import { type KnowledgeStatus, type Prisma } from '@ai-planning/database';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { EmbeddingError } from './embedding.provider.js';
import { storeIndexChunks, type EmbeddedChunk } from './knowledge-chunk-writer.js';
import type { ParsedKnowledgeDocument } from './knowledge-parser.js';
import { sameIndexIdentity, type IndexBeginInput } from './knowledge-index-identity.js';

export interface IndexIdentity {
  readonly model: string;
  readonly dimensions: number;
  readonly version: string;
}

type BeginInput = IndexBeginInput;
interface CompleteInput {
  readonly sourceId: string;
  readonly revisionId: string;
  readonly document: ParsedKnowledgeDocument;
  readonly chunks: readonly EmbeddedChunk[];
  readonly warningCount: number;
  readonly indexerVersion: string;
}
interface CompleteManyInput {
  readonly sourceId: string;
  readonly revisionId: string;
  readonly documents: readonly {
    document: ParsedKnowledgeDocument;
    chunks: readonly EmbeddedChunk[];
  }[];
  readonly warningCount: number;
  readonly indexerVersion: string;
}
@Injectable()
export class KnowledgeIndexStore {
  constructor(private readonly db: PrismaService) {}

  begin(input: BeginInput): Promise<{ id: string; number: number } | null> {
    return this.db.client.$transaction((tx) => this.beginTransaction(tx, input));
  }

  complete(input: CompleteInput): Promise<void> {
    return this.db.client.$transaction(async (tx) => {
      await storeIndexChunks(tx, input);
      await this.activateRevision(tx, input);
    });
  }

  completeMany(input: CompleteManyInput): Promise<void> {
    return this.db.client.$transaction(async (tx) => {
      for (const item of input.documents) {
        await storeIndexChunks(tx, { ...input, ...item });
      }
      await this.activateRevision(tx, input);
    });
  }

  async fail(sourceId: string, revisionId: string, error: unknown): Promise<void> {
    const code = error instanceof EmbeddingError ? error.code : ErrorCode.KNOWLEDGE_INDEXING_FAILED;
    const message = error instanceof EmbeddingError ? error.message : 'Knowledge indexing failed';
    await this.db.client.$transaction([
      this.db.client.knowledgeRevision.update({
        where: { id: revisionId },
        data: {
          status: 'failed',
          error_code: code,
          error_message: message,
          completed_at: new Date(),
          is_active: false,
        },
      }),
      this.db.client.knowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: 'failed',
          error_code: code,
          error_message: message,
          updated_at: new Date(),
        },
      }),
    ]);
  }

  private async beginTransaction(
    tx: Prisma.TransactionClient,
    input: BeginInput,
  ): Promise<{ id: string; number: number } | null> {
    const source = await tx.knowledgeSource.findFirst({
      where: { id: input.sourceId, project_id: input.projectId, deleted_at: null },
    });
    if (!source) {
      throw AppException.notFound(
        ErrorCode.KNOWLEDGE_SOURCE_NOT_FOUND,
        'Knowledge source not found',
      );
    }
    if (source.status === 'processing') {
      throw AppException.conflict(
        ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
        'Knowledge source is already processing',
      );
    }
    const active = await tx.knowledgeRevision.findFirst({
      where: { source_id: input.sourceId, is_active: true },
    });
    const sameIndex = active?.status === 'ready' && sameIndexIdentity(active, input);
    await this.claimSource(tx, {
      sourceId: input.sourceId,
      currentStatus: source.status,
      readyStatus: sameIndex ? active.status : null,
    });
    if (sameIndex) return null;
    return this.createRevision(tx, input);
  }

  private async claimSource(
    tx: Prisma.TransactionClient,
    input: {
      sourceId: string;
      currentStatus: KnowledgeStatus;
      readyStatus: KnowledgeStatus | null;
    },
  ): Promise<void> {
    const claimed = await tx.knowledgeSource.updateMany({
      where: { id: input.sourceId, status: input.currentStatus },
      data: {
        status: input.readyStatus ?? 'processing',
        warning_count: input.readyStatus ? undefined : 0,
        error_code: null,
        error_message: null,
        updated_at: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw AppException.conflict(
        ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
        'Knowledge source state changed',
      );
    }
  }

  private async createRevision(
    tx: Prisma.TransactionClient,
    input: BeginInput,
  ): Promise<{ id: string; number: number }> {
    const latest = await tx.knowledgeRevision.findFirst({
      where: { source_id: input.sourceId },
      orderBy: { revision: 'desc' },
    });
    const created = await tx.knowledgeRevision.create({
      data: {
        source_id: input.sourceId,
        revision: (latest?.revision ?? 0) + 1,
        content_hash: input.contentHash,
        status: 'processing',
        embedding_model: input.identity.model,
        embedding_dimensions: input.identity.dimensions,
        indexer_version: input.identity.version,
      },
    });
    return { id: created.id, number: created.revision };
  }

  private async activateRevision(
    tx: Prisma.TransactionClient,
    input: Pick<CompleteInput, 'sourceId' | 'revisionId' | 'warningCount'>,
  ): Promise<void> {
    const status = input.warningCount > 0 ? 'ready_with_warnings' : 'ready';
    const warning = input.warningCount ? 'Some chunks could not be embedded' : null;
    await tx.knowledgeRevision.updateMany({
      where: { source_id: input.sourceId, is_active: true },
      data: { is_active: false },
    });
    await tx.knowledgeRevision.update({
      where: { id: input.revisionId },
      data: {
        status,
        warning_count: input.warningCount,
        error_code: warning ? 'EMBEDDING_PARTIAL_FAILURE' : null,
        error_message: warning,
        is_active: true,
        completed_at: new Date(),
      },
    });
    await tx.knowledgeSource.update({
      where: { id: input.sourceId },
      data: {
        status,
        warning_count: input.warningCount,
        error_code: warning ? 'EMBEDDING_PARTIAL_FAILURE' : null,
        error_message: warning,
        updated_at: new Date(),
      },
    });
  }
}
