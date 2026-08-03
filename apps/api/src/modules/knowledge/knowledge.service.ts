import { Injectable } from '@nestjs/common';
import type { KnowledgeSource } from '@ai-planning/shared';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { KnowledgeIndexerService } from './knowledge-indexer.service.js';
import type { ParsedKnowledgeDocument, UploadedKnowledgeFile } from './knowledge-parser.js';
import {
  toKnowledgeSourceResponse,
  type KnowledgeSourceListResponse,
  type SourceWithActiveRevision,
} from './knowledge.dto.js';

export interface CreateKnowledgeSourceResult {
  readonly created: boolean;
  readonly source: KnowledgeSource;
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    private readonly indexer: KnowledgeIndexerService,
  ) {}

  async create(
    projectId: string,
    file: UploadedKnowledgeFile,
  ): Promise<CreateKnowledgeSourceResult> {
    await this.projects.findOrFail(projectId);
    const document = await this.indexer.parse(file);
    const existing = await this.findByHash(projectId, document.contentHash);
    if (existing) return { created: false, source: toKnowledgeSourceResponse(existing) };
    const source = await this.createSource(projectId, document);
    if (!source.created) return { created: false, source: toKnowledgeSourceResponse(source.row) };
    // ponytail: synchronous P0 indexing; move to a persistent worker when request latency exceeds the limit.
    await this.indexer.index(projectId, source.row.id, document);
    return {
      created: true,
      source: toKnowledgeSourceResponse(await this.findOrFail(projectId, source.row.id)),
    };
  }

  async list(projectId: string): Promise<KnowledgeSourceListResponse> {
    await this.projects.findOrFail(projectId);
    const where = { project_id: projectId, deleted_at: null };
    const [items, total] = await Promise.all([
      this.db.client.knowledgeSource.findMany({
        where,
        include: activeRevisionInclude,
        orderBy: { created_at: 'desc' },
      }),
      this.db.client.knowledgeSource.count({ where }),
    ]);
    return { items: items.map(toKnowledgeSourceResponse), total };
  }

  async reindex(projectId: string, sourceId: string): Promise<KnowledgeSource> {
    await this.projects.findOrFail(projectId);
    const source = await this.findOrFail(projectId, sourceId);
    if (!source.content_text) {
      throw AppException.conflict(
        ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
        'Knowledge source content is unavailable',
      );
    }
    const buffer = Buffer.from(source.content_text, 'utf8');
    const document = await this.indexer.parse({
      originalname: source.name,
      mimetype: source.mime_type ?? '',
      size: buffer.byteLength,
      buffer,
    });
    await this.indexer.index(projectId, sourceId, document);
    return toKnowledgeSourceResponse(await this.findOrFail(projectId, sourceId));
  }

  async remove(projectId: string, sourceId: string): Promise<void> {
    await this.projects.findOrFail(projectId);
    const removed = await this.db.client.knowledgeSource.updateMany({
      where: {
        id: sourceId,
        project_id: projectId,
        deleted_at: null,
        status: { not: 'processing' },
      },
      data: {
        status: 'deleted',
        content_text: null,
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
    if (removed.count === 1) return;
    const source = await this.db.client.knowledgeSource.findFirst({
      where: { id: sourceId, project_id: projectId, deleted_at: null },
    });
    if (source?.status === 'processing') {
      throw AppException.conflict(
        ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
        'Knowledge source is processing',
      );
    }
    throw AppException.notFound(ErrorCode.KNOWLEDGE_SOURCE_NOT_FOUND, 'Knowledge source not found');
  }

  private async createSource(
    projectId: string,
    document: ParsedKnowledgeDocument,
  ): Promise<{ created: boolean; row: SourceWithActiveRevision }> {
    try {
      const row = await this.db.client.knowledgeSource.create({
        data: {
          project_id: projectId,
          kind: 'file',
          name: document.name,
          mime_type: document.mimeType,
          content_hash: document.contentHash,
          content_text: document.content,
          status: 'pending',
          updated_at: new Date(),
        },
      });
      return { created: true, row: { ...row, revisions: [] } };
    } catch (error) {
      const existing = await this.findByHash(projectId, document.contentHash);
      if (existing) return { created: false, row: existing };
      throw error;
    }
  }

  private findByHash(projectId: string, contentHash: string) {
    return this.db.client.knowledgeSource.findFirst({
      where: { project_id: projectId, content_hash: contentHash, deleted_at: null },
      include: activeRevisionInclude,
    });
  }

  private async findOrFail(projectId: string, sourceId: string) {
    const source = await this.db.client.knowledgeSource.findFirst({
      where: { id: sourceId, project_id: projectId, deleted_at: null },
      include: activeRevisionInclude,
    });
    if (!source) {
      throw AppException.notFound(
        ErrorCode.KNOWLEDGE_SOURCE_NOT_FOUND,
        'Knowledge source not found',
      );
    }
    return source;
  }
}

const activeRevisionInclude = {
  revisions: { where: { is_active: true }, select: { revision: true, is_active: true } },
} as const;
