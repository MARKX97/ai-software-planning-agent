import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const project = {
  id: 'project-1',
  name: 'Planner',
  original_idea: 'Turn ideas into plans',
  status: 'active',
  current_stage: 'init',
  requirement_text: null,
  error_message: null,
  started_at: null,
  completed_at: null,
  created_at: createdAt,
  updated_at: createdAt,
  deleted_at: null,
} as never;

describe('ProjectsService', () => {
  it('creates projects with the documented initial state', async () => {
    let data: Record<string, unknown> | undefined;
    const db = {
      client: {
        project: {
          create: async (args: { data: Record<string, unknown> }) => {
            data = args.data;
            return project;
          },
        },
      },
    };
    const service = new ProjectsService(db as never, {} as never);
    const result = await service.create({ name: 'Planner', original_idea: 'Idea' });
    assert.equal(result.id, 'project-1');
    assert.deepEqual(
      {
        name: data?.name,
        original_idea: data?.original_idea,
        status: data?.status,
        stage: data?.current_stage,
      },
      { name: 'Planner', original_idea: 'Idea', status: 'active', stage: 'init' },
    );
  });

  it('filters and paginates the active project list', async () => {
    let findArgs: Record<string, unknown> | undefined;
    const db = {
      client: {
        project: {
          findMany: async (args: Record<string, unknown>) => {
            findArgs = args;
            return [project];
          },
          count: async () => 1,
        },
      },
    };
    const service = new ProjectsService(db as never, {} as never);
    const result = await service.list({ offset: 20, limit: 10, status: 'active' });
    assert.deepEqual(findArgs, {
      where: { deleted_at: null, status: 'active' },
      orderBy: { created_at: 'desc' },
      skip: 20,
      take: 10,
    });
    assert.deepEqual(
      { total: result.total, offset: result.offset, limit: result.limit },
      { total: 1, offset: 20, limit: 10 },
    );
  });

  it('hides soft-deleted projects and delegates config values', async () => {
    const db = {
      client: { project: { findUnique: async () => ({ ...project, deleted_at: createdAt }) } },
    };
    const service = new ProjectsService(
      db as never,
      { costLimitPerProject: 7.5, dataDir: '/tmp/project-data' } as never,
    );
    await assert.rejects(
      () => service.get('project-1'),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.PROJECT_NOT_FOUND,
    );
    assert.equal(service.costLimitPerProject(), 7.5);
    assert.equal(service.dataDir(), '/tmp/project-data');
  });

  it('soft deletes only after confirming project ownership', async () => {
    let update: unknown;
    const db = {
      client: {
        project: {
          findUnique: async () => project,
          update: async (args: unknown) => {
            update = args;
            return project;
          },
        },
      },
    };
    await new ProjectsService(db as never, {} as never).softDelete('project-1');
    assert.equal((update as { where: { id: string } }).where.id, 'project-1');
    assert.ok((update as { data: { deleted_at: Date } }).data.deleted_at instanceof Date);
  });
});
