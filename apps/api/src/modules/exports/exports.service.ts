import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Artifact, Export, ExportFormat } from '@ai-planning/database';
import { PrismaService } from '../../database/database.module.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { toExportResponse, type ExportRequest, type ExportResponse } from './exports.dto.js';
import { exportContentType, renderExport } from './export-renderer.js';

const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;

export interface ExportDownload {
  readonly content: Buffer;
  readonly filename: string;
  readonly contentType: string;
}

/** Creates export files, reports their status, and validates download tokens. */
@Injectable()
export class ExportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
    private readonly config: AppConfigService,
  ) {}

  async createExport(projectId: string, input: ExportRequest): Promise<ExportResponse> {
    await this.projects.findOrFail(projectId);
    const artifacts = await this.findArtifacts(projectId, input.artifact_types);
    if (artifacts.length === 0) {
      throw AppException.conflict(
        ErrorCode.EXPORT_NOT_READY,
        'Artifacts not ready. Workflow must be completed first.',
      );
    }
    const row = await this.createProcessingRow(projectId, input, artifacts.length);
    try {
      return await this.completeExport(row, artifacts);
    } catch {
      await this.db.client.export.update({
        where: { id: row.id },
        data: { status: 'failed', error_message: 'Export generation failed' },
      });
      throw AppException.internal('Export generation failed', ErrorCode.EXPORT_FAILED);
    }
  }

  async getExport(projectId: string, exportId: string): Promise<ExportResponse> {
    const row = await this.findExport(projectId, exportId);
    return toExportResponse(row, this.activeToken(row));
  }

  async getDownload(projectId: string, exportId: string, token: string): Promise<ExportDownload> {
    const row = await this.findExport(projectId, exportId);
    if (!this.canDownload(row, token) || !row.file_path) {
      throw AppException.notFound(ErrorCode.EXPORT_NOT_FOUND, `Export '${exportId}' not found`);
    }
    let content: Buffer;
    try {
      content = await readFile(resolve(this.config.dataDir, row.file_path));
    } catch {
      throw AppException.notFound(ErrorCode.EXPORT_NOT_FOUND, `Export '${exportId}' not found`);
    }
    return {
      content,
      filename: `planning-export.${this.extension(row.format)}`,
      contentType: exportContentType(row.format),
    };
  }

  private findArtifacts(projectId: string, types: string[]): Promise<Artifact[]> {
    return this.db.client.artifact.findMany({
      where: {
        project_id: projectId,
        deleted_at: null,
        ...(types.length ? { type: { in: types as never[] } } : {}),
      },
      orderBy: { created_at: 'asc' },
    });
  }

  private createProcessingRow(
    projectId: string,
    input: ExportRequest,
    artifactCount: number,
  ): Promise<Export> {
    return this.db.client.export.create({
      data: {
        project_id: projectId,
        format: input.format,
        status: 'processing',
        artifact_types: input.artifact_types,
        artifact_count: artifactCount,
      },
    });
  }

  private async completeExport(row: Export, artifacts: Artifact[]): Promise<ExportResponse> {
    const rendered = renderExport(row.format, artifacts);
    const relativePath = join('exports', row.project_id, `${row.id}.${rendered.extension}`);
    const fullPath = resolve(this.config.dataDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, rendered.content);
    const token = this.token(row.id);
    const completed = await this.db.client.export.update({
      where: { id: row.id },
      data: {
        status: 'completed',
        file_path: relativePath,
        file_size_bytes: rendered.content.length,
        download_token_hash: this.hash(token),
        download_expires_at: new Date(Date.now() + DOWNLOAD_TTL_MS),
        completed_at: new Date(),
      },
    });
    return toExportResponse(completed, token);
  }

  private async findExport(projectId: string, exportId: string): Promise<Export> {
    await this.projects.findOrFail(projectId);
    const row = await this.db.client.export.findUnique({ where: { id: exportId } });
    if (!row || row.project_id !== projectId) {
      throw AppException.notFound(ErrorCode.EXPORT_NOT_FOUND, `Export '${exportId}' not found`);
    }
    return row;
  }

  private canDownload(row: Export, token: string): boolean {
    if (row.status !== 'completed' || !row.download_token_hash || !row.download_expires_at) {
      return false;
    }
    const expected = Buffer.from(row.download_token_hash, 'hex');
    const actual = Buffer.from(this.hash(token), 'hex');
    return row.download_expires_at > new Date() && timingSafeEqual(expected, actual);
  }

  private activeToken(row: Export): string | undefined {
    if (row.status !== 'completed' || !row.download_expires_at || !row.download_token_hash) {
      return undefined;
    }
    const token = this.token(row.id);
    const valid = this.hash(token) === row.download_token_hash;
    return valid && row.download_expires_at > new Date() ? token : undefined;
  }

  private token(exportId: string): string {
    return this.hash(`${this.config.downloadTokenSecret}:${exportId}`);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private extension(format: ExportFormat): string {
    return format === 'markdown' ? 'md' : format;
  }
}
