import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExportsService } from '../../src/modules/exports/exports.service.js';
import { renderExport } from '../../src/modules/exports/export-renderer.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const exportRow = {
  id: 'export-1',
  project_id: 'project-1',
  format: 'markdown',
  status: 'processing',
  artifact_count: 1,
  file_path: null,
  file_size_bytes: null,
  download_token_hash: null,
  download_expires_at: null,
  error_message: null,
  created_at: createdAt,
  completed_at: null,
} as never;

const artifactRow = {
  id: 'artifact-1',
  project_id: 'project-1',
  type: 'prd',
  title: 'PRD',
  content: '# Product requirements',
  created_at: createdAt,
} as never;

describe('ExportsService', () => {
  it('renders every documented format without external dependencies', () => {
    for (const format of ['markdown', 'pdf', 'html', 'json'] as const) {
      const rendered = renderExport(format, [artifactRow]);
      assert.ok(rendered.content.length > 0);
      if (format === 'pdf') assert.match(rendered.content.subarray(0, 8).toString(), /%PDF-1.4/);
    }
  });

  it('renders a completed export and serves it with the generated token', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'export-service-'));
    let current = exportRow as Record<string, unknown>;
    const db = {
      client: {
        artifact: { findMany: async () => [artifactRow] },
        export: {
          create: async () => exportRow,
          update: async ({ data }: { data: Record<string, unknown> }) => {
            current = { ...current, ...data };
            return current;
          },
          findUnique: async () => current,
        },
      },
    };
    const service = new ExportsService(
      db as never,
      { findOrFail: async () => ({}) } as never,
      { dataDir, downloadTokenSecret: 'test-secret' } as never,
    );
    try {
      const result = await service.createExport('project-1', {
        format: 'markdown',
        artifact_types: ['prd'],
      });
      assert.equal(result.status, 'completed');
      assert.equal(result.artifact_count, 1);
      assert.ok(result.download_url);
      const token = new URL(result.download_url, 'http://localhost').searchParams.get('token');
      assert.ok(token);
      const download = await service.getDownload('project-1', 'export-1', token);
      assert.match(download.content.toString(), /Product requirements/);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it('rejects exports when no artifacts are ready', async () => {
    const db = { client: { artifact: { findMany: async () => [] } } };
    const service = new ExportsService(
      db as never,
      { findOrFail: async () => ({}) } as never,
      { dataDir: tmpdir(), downloadTokenSecret: 'test-secret' } as never,
    );
    await assert.rejects(
      () => service.createExport('project-1', { format: 'markdown', artifact_types: [] }),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.EXPORT_NOT_READY,
    );
  });
});
