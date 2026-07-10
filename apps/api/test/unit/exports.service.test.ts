import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExportsService } from '../../src/modules/exports/exports.service.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';

const exportRow = {
  id: 'export-1',
  project_id: 'project-1',
  format: 'markdown',
  status: 'processing',
  artifact_count: 1,
  file_path: null,
  file_size_bytes: null,
  error_message: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  completed_at: null,
} as never;

describe('ExportsService', () => {
  it('creates a processing export with the active artifact count', async () => {
    let createData: Record<string, unknown> | undefined;
    const db = {
      client: {
        artifact: { count: async () => 1 },
        export: {
          create: async (args: { data: Record<string, unknown> }) => {
            createData = args.data;
            return exportRow;
          },
        },
      },
    };
    const service = new ExportsService(db as never, { findOrFail: async () => ({}) } as never);
    const result = await service.createExport('project-1', {
      format: 'markdown',
      artifact_types: [],
    });
    assert.equal(result.status, 'processing');
    assert.equal(createData?.artifact_count, 1);
    assert.equal(createData?.project_id, 'project-1');
  });

  it('does not expose a download before the export is completed', async () => {
    const db = {
      client: { export: { findUnique: async () => exportRow } },
    };
    const service = new ExportsService(db as never, { findOrFail: async () => ({}) } as never);
    await assert.rejects(
      () => service.getDownload('project-1', 'export-1'),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.EXPORT_NOT_FOUND,
    );
  });
});
