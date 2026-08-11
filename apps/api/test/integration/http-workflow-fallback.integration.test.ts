import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const enabled = process.env['RUN_FALLBACK_INTEGRATION'] === '1';
const mode = process.env['EXPECTED_WORKFLOW_MODE'];
const base = process.env['API_TEST_URL'] ?? 'http://127.0.0.1:3001/api/v1';

describe('HTTP workflow operational fallback', () => {
  it(`completes the ${mode ?? 'configured'} runner`, { skip: !enabled }, async () => {
    assert.ok(mode === 'p1' || mode === 'v2');
    const project = await json('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: `fallback-${mode}-${Date.now()}`,
        original_idea: 'Plan a focused personal productivity product.',
      }),
    });
    assert.equal(project.response.status, 201);
    const projectId = String(project.body['id']);
    try {
      let status = await stream(`/projects/${projectId}/run`, {});
      for (let round = 0; status['waiting_for'] === 'reply' && round < 5; round += 1) {
        status = await stream(`/projects/${projectId}/workflow/continue`, {
          conversation_id: status['conversation_id'],
          message: `Round ${round + 1}: single user, local-first, measurable weekly outcome.`,
          ...resumeFields(status),
        });
      }
      assert.equal(status['waiting_for'], 'review');
      for (
        let checkpoint = 0;
        status['current_stage'] !== 'completed' && checkpoint < 4;
        checkpoint += 1
      ) {
        const advanced = await json(`/projects/${projectId}/workflow/advance`, {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: status['conversation_id'],
            ...resumeFields(status),
          }),
        });
        assert.equal(advanced.response.status, 202);
        status = advanced.body;
      }
      assert.equal(status['current_stage'], 'completed');
      const states = await json(`/projects/${projectId}/workflow/states`);
      assert.equal(states.body['total'], 9);
      assert.ok(
        (states.body['items'] as Array<{ status: string }>).every(
          (item) => item.status === 'completed',
        ),
      );
      const artifacts = await json(`/projects/${projectId}/artifacts`);
      assert.equal(artifacts.body['total'], 11);
      if (mode === 'v2') assert.equal(status['graph_run'], null);
      if (mode === 'p1') {
        const graph = status['graph_run'] as Record<string, unknown>;
        assert.ok(graph);
        assert.equal(graph['tool_call_count'], 0);
      }
    } finally {
      const removed = await json(`/projects/${projectId}`, { method: 'DELETE' });
      assert.equal(removed.response.status, 204);
    }
  });
});

function resumeFields(status: Record<string, unknown>): Record<string, unknown> {
  const graph = status['graph_run'];
  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) return {};
  const data = graph as Record<string, unknown>;
  return { graph_run_id: data['id'], checkpoint_version: data['checkpoint_version'] };
}

async function json(path: string, options: RequestInit = {}) {
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

async function stream(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).split(/\r?\n\r?\n/);
  const done = events.find((event) => event.includes('event: done'));
  assert.ok(done);
  const data = done
    .split(/\r?\n/)
    .find((line) => line.startsWith('data:'))
    ?.slice(5)
    .trim();
  assert.ok(data);
  const payload = JSON.parse(data) as { status: Record<string, unknown> };
  return payload.status;
}
