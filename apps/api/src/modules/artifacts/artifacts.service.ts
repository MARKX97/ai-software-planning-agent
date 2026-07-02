import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  toArtifactListItem,
  toArtifactResponse,
  type ArtifactListResponse,
  type ArtifactResponse,
  type ListArtifactsQuery,
} from './artifacts.dto.js';

/**
 * Artifacts service backed by Prisma.
 * @internal
 */
@Injectable()
export class ArtifactsService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async list(projectId: string, query: ListArtifactsQuery): Promise<ArtifactListResponse> {
    await this.projects.findOrFail(projectId);
    const where = {
      project_id: projectId,
      deleted_at: null,
      ...(query.type ? { type: query.type } : {}),
    };
    const items = await this.db.client.artifact.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });
    return { items: items.map(toArtifactListItem), total: items.length };
  }

  async get(projectId: string, artifactId: string): Promise<ArtifactResponse> {
    await this.projects.findOrFail(projectId);
    const artifact = await this.db.client.artifact.findUnique({ where: { id: artifactId } });
    if (!artifact || artifact.project_id !== projectId || artifact.deleted_at) {
      throw AppException.notFound(
        ErrorCode.ARTIFACT_NOT_FOUND,
        `Artifact '${artifactId}' not found`,
      );
    }
    return toArtifactResponse(artifact);
  }

  /** Return raw content + filename for the download endpoint. */
  async getDownload(
    projectId: string,
    artifactId: string,
  ): Promise<{ content: string; filename: string }> {
    const artifact = await this.get(projectId, artifactId);
    const safeName = (artifact.title || artifact.type).replace(/[^a-zA-Z0-9-_]/g, '_');
    return { content: artifact.content ?? '', filename: `${safeName}.md` };
  }
}
