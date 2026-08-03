import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '@ai-planning/database';
import { PrismaService } from '../../src/database/database.module.js';
import { KnowledgeIndexStore } from '../../src/modules/knowledge/knowledge-index.store.js';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';
const base = process.env['API_TEST_URL'] ?? 'http://127.0.0.1:3001/api/v1';

async function jsonRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  return { response, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

async function upload(projectId: string, content: string) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/markdown' }), 'guide.md');
  const response = await fetch(`${base}/projects/${projectId}/knowledge/sources`, {
    method: 'POST',
    body: form,
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

describe('real HTTP + PostgreSQL knowledge integration', () => {
  it(
    'indexes idempotently, retries warnings, retains active data on failure, and deletes text',
    { skip: !enabled },
    async () => {
      let projectId = '';
      let otherProjectId = '';
      try {
        const project = await jsonRequest('/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: `knowledge-${Date.now()}`,
            original_idea: 'Knowledge fixture',
          }),
        });
        assert.equal(project.response.status, 201);
        projectId = String(project.body?.['id']);

        const markdown = '# Deployment\n\nUse PostgreSQL 16 and keep migrations atomic.';
        const created = await upload(projectId, markdown);
        assert.equal(created.response.status, 201);
        assert.equal(created.body['status'], 'ready');
        assert.equal(created.body['active_revision'], 1);
        const sourceId = String(created.body['id']);

        const searched = await jsonRequest(`/projects/${projectId}/knowledge/search`, {
          method: 'POST',
          body: JSON.stringify({ query: 'PostgreSQL', top_k: 8 }),
        });
        assert.equal(searched.response.status, 200);
        const evidence = (searched.body?.['items'] as Array<Record<string, unknown>>)[0];
        assert.equal(evidence?.['sourceId'], sourceId);

        const otherProject = await jsonRequest('/projects', {
          method: 'POST',
          body: JSON.stringify({ name: `other-${Date.now()}`, original_idea: 'Other fixture' }),
        });
        otherProjectId = String(otherProject.body?.['id']);
        const otherUpload = await upload(
          otherProjectId,
          '# Other\n\nPostgreSQL belongs elsewhere.',
        );
        assert.equal(otherUpload.response.status, 201);
        const isolated = await jsonRequest(`/projects/${projectId}/knowledge/search`, {
          method: 'POST',
          body: JSON.stringify({
            query: 'PostgreSQL',
            source_ids: [String(otherUpload.body['id'])],
          }),
        });
        assert.deepEqual(isolated.body, { items: [], insufficient_evidence: true });

        const duplicate = await upload(projectId, markdown);
        assert.equal(duplicate.response.status, 200);
        assert.equal(duplicate.body['id'], sourceId);
        const firstReindex = await jsonRequest(
          `/projects/${projectId}/knowledge/sources/${sourceId}/reindex`,
          { method: 'POST' },
        );
        assert.equal(firstReindex.response.status, 200);
        assert.equal(firstReindex.body?.['active_revision'], 1);

        const store = new KnowledgeIndexStore(new PrismaService());
        const failedRevision = await store.begin({
          projectId,
          sourceId,
          contentHash: String(created.body['content_hash']),
          identity: { model: 'mock-embedding-v2', dimensions: 8, version: 'test-v2' },
        });
        assert.ok(failedRevision);
        await store.fail(sourceId, failedRevision.id, new Error('sensitive raw failure'));
        const revisionsAfterFailure = await prisma.knowledgeRevision.findMany({
          where: { source_id: sourceId },
        });
        assert.equal(revisionsAfterFailure.filter((revision) => revision.is_active).length, 1);
        assert.equal(revisionsAfterFailure.find((revision) => revision.is_active)?.revision, 1);
        assert.equal(
          revisionsAfterFailure.find((revision) => revision.id === failedRevision.id)?.status,
          'failed',
        );
        assert.equal(
          revisionsAfterFailure.find((revision) => revision.id === failedRevision.id)
            ?.error_message,
          'Knowledge indexing failed',
        );

        const repaired = await jsonRequest(
          `/projects/${projectId}/knowledge/sources/${sourceId}/reindex`,
          { method: 'POST' },
        );
        assert.equal(repaired.response.status, 200);
        assert.equal(repaired.body?.['status'], 'ready');
        assert.equal(repaired.body?.['active_revision'], 1);

        await prisma.$transaction([
          prisma.knowledgeRevision.updateMany({
            where: { source_id: sourceId, is_active: true },
            data: { status: 'ready_with_warnings' },
          }),
          prisma.knowledgeSource.update({
            where: { id: sourceId },
            data: { status: 'ready_with_warnings' },
          }),
        ]);
        const retriedWarning = await jsonRequest(
          `/projects/${projectId}/knowledge/sources/${sourceId}/reindex`,
          { method: 'POST' },
        );
        assert.equal(retriedWarning.response.status, 200);
        assert.equal(retriedWarning.body?.['status'], 'ready');
        assert.equal(retriedWarning.body?.['active_revision'], 3);

        const artifact = await prisma.artifact.create({
          data: {
            project_id: projectId,
            type: 'prd',
            type_display_name: 'PRD',
            title: 'Cited PRD',
            stage: 'planning_generation',
            content: '# Cited PRD\n\nPostgreSQL is required. [S1]',
            updated_at: new Date(),
            citations: {
              create: {
                source_id: String(evidence?.['sourceId']),
                document_id: String(evidence?.['documentId']),
                chunk_id: String(evidence?.['chunkId']),
                citation_key: 'S1',
                position: 1,
                title: String(evidence?.['title']),
                locator: String(evidence?.['locator']),
                excerpt: String(evidence?.['excerpt']),
                content_hash: String(evidence?.['contentHash']),
              },
            },
          },
        });

        const removed = await jsonRequest(`/projects/${projectId}/knowledge/sources/${sourceId}`, {
          method: 'DELETE',
        });
        assert.equal(removed.response.status, 204);
        const deleted = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
        assert.equal(deleted.status, 'deleted');
        assert.equal(deleted.content_text, null);
        const afterDelete = await jsonRequest(`/projects/${projectId}/knowledge/search`, {
          method: 'POST',
          body: JSON.stringify({ query: 'PostgreSQL' }),
        });
        assert.deepEqual(afterDelete.body, { items: [], insufficient_evidence: true });
        const citedArtifact = await jsonRequest(`/projects/${projectId}/artifacts/${artifact.id}`);
        const citations = citedArtifact.body?.['citations'] as Array<Record<string, unknown>>;
        assert.equal(citations[0]?.['citationKey'], 'S1');
        assert.equal(citations[0]?.['sourceId'], sourceId);
      } finally {
        if (otherProjectId)
          await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => undefined);
        if (projectId)
          await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
      }
    },
  );
});
