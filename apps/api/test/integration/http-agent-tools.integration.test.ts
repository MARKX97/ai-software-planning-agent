import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma, type ArtifactType } from '@ai-planning/database';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';
const base = process.env['API_TEST_URL'] ?? 'http://127.0.0.1:3001/api/v1';
const artifactTypes: ArtifactType[] = [
  'requirement_report',
  'feasibility_report',
  'risk_report',
  'mvp_plan',
  'platform_recommendation',
  'prd',
  'architecture',
  'frontend_spec',
  'backend_spec',
  'project_plan',
  'ai_coding_rules',
];
const affectedTypes = new Set([
  'prd',
  'architecture',
  'frontend_spec',
  'backend_spec',
  'project_plan',
  'ai_coding_rules',
]);

describe('real HTTP + PostgreSQL P2 integration', () => {
  it(
    'audits a Tool and regenerates only affected artifacts without duplicate cost',
    { skip: !enabled },
    async () => {
      let projectId = '';
      try {
        projectId = await createCompletedProject();
        const before = await activeArtifactIds(projectId);
        const source = await uploadSource(projectId);
        assert.equal(source.response.status, 201);
        assert.match(String(source.body['status']), /^ready/);

        const stale = await jsonRequest(`/projects/${projectId}/workflow/status`);
        assert.equal(stale.response.status, 200);
        const impact = stale.body['regeneration'] as Record<string, unknown>;
        assert.deepEqual(impact['affected_artifacts'], [...affectedTypes]);

        const regenerated = await jsonRequest(`/projects/${projectId}/workflow/regenerate`, {
          method: 'POST',
        });
        assert.equal(regenerated.response.status, 202);
        assert.equal(regenerated.body['current_stage'], 'completed');
        assert.equal(regenerated.body['regeneration'], null);
        const graphRun = regenerated.body['graph_run'] as Record<string, unknown>;
        assert.equal(graphRun['tool_call_count'], 1);
        assert.match(String(graphRun['retrieval_summary']), /1 次 Tool/);
        assert.doesNotMatch(JSON.stringify(graphRun), /PostgreSQL source of truth/);

        const after = await activeArtifactIds(projectId);
        assert.equal(after.size, artifactTypes.length);
        for (const [type, id] of after) {
          assert.equal(id === before.get(type), !affectedTypes.has(type));
        }
        const usage = await tokenCallCount(projectId);
        const duplicate = await jsonRequest(`/projects/${projectId}/workflow/regenerate`, {
          method: 'POST',
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(await tokenCallCount(projectId), usage);
      } finally {
        if (projectId) {
          await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
        }
      }
    },
  );
});

async function createCompletedProject(): Promise<string> {
  const created = await jsonRequest('/projects', {
    method: 'POST',
    body: JSON.stringify({ name: `p2-${Date.now()}`, original_idea: 'P2 fixture' }),
  });
  assert.equal(created.response.status, 201);
  const projectId = String(created.body['id']);
  const artifactTime = new Date('2026-08-01T00:00:00.000Z');
  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'completed',
        current_stage: 'completed',
        completed_at: artifactTime,
        updated_at: artifactTime,
      },
    }),
    prisma.artifact.createMany({
      data: artifactTypes.map((type) => ({
        project_id: projectId,
        type,
        type_display_name: type,
        title: type,
        stage: 'planning_generation',
        content: `# ${type}\n\nInitial content`,
        created_at: artifactTime,
        updated_at: artifactTime,
      })),
    }),
  ]);
  const conversation = await prisma.conversation.create({
    data: { project_id: projectId, status: 'closed', updated_at: artifactTime },
  });
  await prisma.message.create({
    data: {
      conversation_id: conversation.id,
      role: 'user',
      content: 'Use the updated evidence.',
      metadata: { workflow: true },
    },
  });
  return projectId;
}

async function uploadSource(projectId: string) {
  const form = new FormData();
  form.set(
    'file',
    new Blob(['# Updated evidence\nKeep PostgreSQL as the source of truth.'], {
      type: 'text/markdown',
    }),
    'updated-context.md',
  );
  const response = await fetch(`${base}/projects/${projectId}/knowledge/sources`, {
    method: 'POST',
    body: form,
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

async function jsonRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

async function activeArtifactIds(projectId: string): Promise<Map<string, string>> {
  const rows = await prisma.artifact.findMany({
    where: { project_id: projectId, deleted_at: null },
    select: { id: true, type: true },
  });
  return new Map(rows.map((row) => [row.type, row.id]));
}

async function tokenCallCount(projectId: string): Promise<number> {
  return (
    (await prisma.tokenUsage.findUnique({ where: { project_id: projectId } }))?.call_count ?? 0
  );
}
