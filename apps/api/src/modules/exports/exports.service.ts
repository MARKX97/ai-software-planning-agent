import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { toExportResponse, type ExportRequest, type ExportResponse } from './exports.dto.js';

/**
 * Export service backed by Prisma.
 *
 * Phase 3 STUB: creates an export row in `processing` status but does NOT
 * actually generate the file (deferred to a later phase).
 * @internal
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async createExport(projectId: string, input: ExportRequest): Promise<ExportResponse> {
    await this.projects.findOrFail(projectId);
    const artifactCount = await this.countArtifacts(projectId, input.artifact_types);
    const row = await this.db.client.export.create({
      data: {
        project_id: projectId,
        format: input.format,
        status: 'processing',
        artifact_types: input.artifact_types,
        artifact_count: artifactCount,
        file_path: null,
        file_size_bytes: null,
      },
    });
    return toExportResponse(row);
  }

  async getExport(projectId: string, exportId: string): Promise<ExportResponse> {
    await this.projects.findOrFail(projectId);
    const row = await this.db.client.export.findUnique({ where: { id: exportId } });
    if (!row || row.project_id !== projectId) {
      throw AppException.notFound(ErrorCode.EXPORT_NOT_FOUND, `Export '${exportId}' not found`);
    }
    return toExportResponse(row);
  }

  /** Phase 3 STUB: exports are never completed yet, so always 404. */
  async getDownload(projectId: string, exportId: string): Promise<never> {
    const exportRow = await this.getExport(projectId, exportId);
    // Phase 3 STUB: no real file generation pipeline yet. Even if a row is
    // present, we only allow download when status='completed'.
    if (exportRow.status !== 'completed') {
      throw AppException.notFound(
        ErrorCode.EXPORT_NOT_FOUND,
        `Export '${exportId}' not ready or token invalid`,
      );
    }
    // Unreachable in Phase 3 (we never complete exports); kept for future use.
    throw AppException.notFound(ErrorCode.EXPORT_NOT_FOUND, `Export '${exportId}' not ready`);
  }

  private async countArtifacts(projectId: string, types: string[]): Promise<number> {
    if (types.length === 0) {
      return this.db.client.artifact.count({
        where: { project_id: projectId, deleted_at: null },
      });
    }
    return this.db.client.artifact.count({
      where: { project_id: projectId, deleted_at: null, type: { in: types as never[] } },
    });
  }
}
