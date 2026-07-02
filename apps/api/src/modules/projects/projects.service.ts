import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.module.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import {
  toProjectResponse,
  type CreateProjectRequest,
  type ListProjectsQuery,
  type ProjectResponse,
} from './projects.dto.js';

/**
 * Project CRUD service backed by Prisma.
 * @internal
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async create(input: CreateProjectRequest): Promise<ProjectResponse> {
    const now = new Date();
    const project = await this.db.client.project.create({
      data: {
        name: input.name,
        original_idea: input.original_idea,
        status: 'active',
        current_stage: 'init',
        updated_at: now,
      },
    });
    return toProjectResponse(project);
  }

  async list(
    query: ListProjectsQuery,
  ): Promise<{ items: ProjectResponse[]; total: number; offset: number; limit: number }> {
    const where = { deleted_at: null, ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await Promise.all([
      this.db.client.project.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.client.project.count({ where }),
    ]);
    return {
      items: items.map(toProjectResponse),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async get(id: string): Promise<ProjectResponse> {
    const project = await this.findOrFail(id);
    return toProjectResponse(project);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOrFail(id);
    await this.db.client.project.update({
      where: { id },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }

  async findOrFail(id: string) {
    const project = await this.db.client.project.findUnique({ where: { id } });
    if (!project || project.deleted_at) {
      throw AppException.notFound(ErrorCode.PROJECT_NOT_FOUND, `Project '${id}' not found`);
    }
    return project;
  }

  /** Cost limit per project (read from config; default 5.0). */
  costLimitPerProject(): number {
    return this.config.costLimitPerProject;
  }
}
