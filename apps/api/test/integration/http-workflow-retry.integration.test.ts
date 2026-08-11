import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';
const base = process.env['API_TEST_URL'] ?? 'http://127.0.0.1:3001/api/v1';

describe('HTTP workflow failure recovery', () => {
  it('restarts the same project after initial failure recovery', { skip: !enabled }, async () => {
    let projectId = '';
    try {
      const project = await json('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: `retry-${Date.now()}`,
          original_idea: 'A workflow that should restart after a transient failure.',
        }),
      });
      assert.equal(project.response.status, 201);
      projectId = String(project.body['id']);
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'failed',
          current_stage: WorkflowStage.FAILED,
          error_message: 'Injected persisted failure state',
          updated_at: new Date(),
        },
      });

      const rerun = await stream(`/projects/${projectId}/run`);

      assert.equal(rerun.response.status, 200);
      assert.equal(rerun.status['current_stage'], WorkflowStage.REQUIREMENT_CLARIFICATION);
      assert.equal(rerun.status['status'], 'active');
    } finally {
      if (projectId) {
        const cleanup = await json(`/projects/${projectId}`, { method: 'DELETE' });
        assert.equal(cleanup.response.status, 204);
      }
    }
  });
});

async function json(path: string, options: RequestInit) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  return {
    response,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

async function stream(path: string) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const event = (await response.text())
    .split(/\r?\n\r?\n/)
    .find((block) => block.includes('event: done'));
  const data = event
    ?.split(/\r?\n/)
    .find((line) => line.startsWith('data:'))
    ?.slice(5)
    .trim();
  assert.ok(data);
  const payload = JSON.parse(data) as { status: Record<string, unknown> };
  return { response, status: payload.status };
}
