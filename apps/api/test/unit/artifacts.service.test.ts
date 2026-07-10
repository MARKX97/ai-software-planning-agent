import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactsService } from '../../src/modules/artifacts/artifacts.service.js';
import { ArtifactFileStore } from '../../src/modules/workflow/artifact-generation/artifact-file-store.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const row = {
  id: 'artifact-1',
  project_id: 'project-1',
  type: 'prd',
  type_display_name: 'PRD',
  title: 'PRD',
  stage: 'planning_generation',
  content: '# PRD',
  file_path: null,
  size_bytes: 5,
  format: 'markdown',
  created_at: createdAt,
  deleted_at: null,
} as never;

describe('ArtifactsService', () => {
  it('lists summaries without content and filters by artifact type', async () => {
    let where: Record<string, unknown> | undefined;
    const db = {
      client: {
        artifact: {
          findMany: async (args: { where: Record<string, unknown> }) => {
            where = args.where;
            return [row];
          },
        },
      },
    };
    const service = new ArtifactsService(db as never, { findOrFail: async () => row } as never);
    const result = await service.list('project-1', { type: 'prd' });
    assert.deepEqual(where, { project_id: 'project-1', deleted_at: null, type: 'prd' });
    assert.equal(result.total, 1);
    assert.equal('content' in result.items[0], false);
  });

  it('returns full content and a safe markdown filename for downloads', async () => {
    const db = { client: { artifact: { findUnique: async () => row } } };
    const service = new ArtifactsService(db as never, { findOrFail: async () => row } as never);
    const detail = await service.get('project-1', 'artifact-1');
    assert.equal(detail.content, '# PRD');
    const download = await service.getDownload('project-1', 'artifact-1');
    assert.deepEqual(download, { content: '# PRD', filename: 'PRD.md' });
  });

  it('rejects an artifact from another project as not found', async () => {
    const foreign = { ...row, project_id: 'other-project' };
    const db = { client: { artifact: { findUnique: async () => foreign } } };
    const service = new ArtifactsService(db as never, { findOrFail: async () => row } as never);
    await assert.rejects(
      () => service.get('project-1', 'artifact-1'),
      (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === ErrorCode.ARTIFACT_NOT_FOUND,
    );
  });

  it('soft-deletes the previous version before creating a new artifact', async () => {
    let archivedWhere: unknown;
    let createdData: Record<string, unknown> | undefined;
    const db = {
      client: {
        artifact: {
          updateMany: async (args: { where: unknown }) => {
            archivedWhere = args.where;
            return { count: 1 };
          },
          create: async (args: { data: Record<string, unknown> }) => {
            createdData = args.data;
            return row;
          },
        },
      },
    };
    await new ArtifactFileStore(db as never).save({
      projectId: 'project-1',
      type: 'prd',
      content: '# New PRD',
    });
    assert.deepEqual(archivedWhere, { project_id: 'project-1', type: 'prd', deleted_at: null });
    assert.equal(createdData?.content, '# New PRD');
  });
});
