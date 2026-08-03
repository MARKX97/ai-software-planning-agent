import { Injectable } from '@nestjs/common';
import type { KnowledgeSource } from '@ai-planning/shared';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { createRepositorySource } from './knowledge-repository-source.js';
import { KnowledgeSourceProcessor, repositorySnapshotHash } from './knowledge-source-processor.js';
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
    private readonly processor: KnowledgeSourceProcessor,
  ) {}

  async create(
    projectId: string,
    file: UploadedKnowledgeFile,
  ): Promise<CreateKnowledgeSourceResult> {
    await this.projects.findOrFail(projectId);
    const document = await this.processor.parse(file);
    const existing = await this.findByHash(projectId, document.contentHash);
    if (existing) return { created: false, source: toKnowledgeSourceResponse(existing) };
    const source = await this.createSource(projectId, document, file);
    if (!source.created) return { created: false, source: toKnowledgeSourceResponse(source.row) };
    // ponytail: synchronous P0 indexing; move to a persistent worker when request latency exceeds the limit.
    await this.processor.index(projectId, source.row.id, document);
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

  async createRepository(
    projectId: string,
    repositoryUrl: string,
  ): Promise<CreateKnowledgeSourceResult> {
    await this.projects.findOrFail(projectId);
    const snapshot = await this.processor.importRepository(repositoryUrl);
    const contentHash = repositorySnapshotHash(snapshot);
    const existing = await this.findByHash(projectId, contentHash);
    if (existing) return { created: false, source: toKnowledgeSourceResponse(existing) };
    let row: SourceWithActiveRevision;
    try {
      row = await createRepositorySource(this.db, { projectId, snapshot, contentHash });
    } catch (error) {
      const duplicate = await this.findByHash(projectId, contentHash);
      if (duplicate) return { created: false, source: toKnowledgeSourceResponse(duplicate) };
      throw error;
    }
    await this.processor.indexRepository(projectId, row.id, snapshot);
    return {
      created: true,
      source: toKnowledgeSourceResponse(await this.findOrFail(projectId, row.id)),
    };
  }

  async reindex(projectId: string, sourceId: string): Promise<KnowledgeSource> {
    await this.projects.findOrFail(projectId);
    const source = await this.findOrFail(projectId, sourceId);
    if (source.kind === 'github_repository') {
      if (!source.source_uri || !source.repository_commit) {
        throw AppException.conflict(
          ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
          'Repository snapshot is unavailable',
        );
      }
      const snapshot = await this.processor.reimportRepository(
        source.source_uri,
        source.repository_commit,
      );
      await this.processor.indexRepository(projectId, sourceId, snapshot);
      return toKnowledgeSourceResponse(await this.findOrFail(projectId, sourceId));
    }
    const content =
      source.content_blob ?? (source.content_text ? Buffer.from(source.content_text) : null);
    if (!content) {
      throw AppException.conflict(
        ErrorCode.KNOWLEDGE_SOURCE_CONFLICT,
        'Knowledge source content is unavailable',
      );
    }
    const document = await this.processor.parse({
      originalname: source.name,
      mimetype: source.mime_type ?? '',
      size: content.byteLength,
      buffer: Buffer.from(content),
    });
    await this.processor.index(projectId, sourceId, document);
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
        content_blob: null,
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
    file: UploadedKnowledgeFile,
  ): Promise<{ created: boolean; row: SourceWithActiveRevision }> {
    try {
      const row = await this.db.client.knowledgeSource.create({
        data: {
          project_id: projectId,
          kind: 'file',
          name: document.name,
          mime_type: document.mimeType,
          content_hash: document.contentHash,
          content_text: document.mimeType === 'application/pdf' ? null : document.content,
          content_blob:
            document.mimeType === 'application/pdf' ? Uint8Array.from(file.buffer) : null,
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
