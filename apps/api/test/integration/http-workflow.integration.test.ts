import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';
const base = process.env['API_TEST_URL'] ?? 'http://127.0.0.1:3001/api/v1';

interface ApiResult {
  readonly response: Response;
  readonly body: Record<string, unknown> | null;
}

async function request(path: string, options: RequestInit = {}): Promise<ApiResult> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = null;
  }
  return { response, body };
}

function bodyOf(result: ApiResult): Record<string, unknown> {
  assert.ok(result.body);
  return result.body;
}

describe('real HTTP + PostgreSQL workflow integration', () => {
  it(
    'covers all documented HTTP routes through the project workflow',
    { skip: !enabled },
    async () => {
      let projectId = '';
      try {
        const health = await request('/health');
        assert.equal(health.response.status, 200);
        assert.equal(bodyOf(health)['database'], 'ok');

        const models = await request('/models');
        assert.equal(models.response.status, 200);
        assert.ok(Array.isArray(bodyOf(models)['items']));
        const model = await request('/models/deepseek');
        assert.equal(model.response.status, 200);
        assert.equal(bodyOf(model)['provider_name'], 'deepseek');

        const project = await request('/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: `integration-${Date.now()}`,
            original_idea: 'An integration test planning project',
          }),
        });
        assert.equal(project.response.status, 201);
        const projectBody = bodyOf(project);
        assert.equal(typeof projectBody['id'], 'string');
        projectId = projectBody['id'] as string;

        const projectDetail = await request(`/projects/${projectId}`);
        assert.equal(projectDetail.response.status, 200);
        const projects = await request('/projects?offset=0&limit=20');
        assert.ok(
          (bodyOf(projects)['items'] as Array<{ id: string }>).some(
            (item) => item.id === projectId,
          ),
        );

        const run = await request(`/projects/${projectId}/run`, {
          method: 'POST',
          body: '{}',
        });
        assert.equal(run.response.status, 202);
        const runBody = bodyOf(run);
        assert.equal(runBody['current_stage'], 'requirement_clarification');
        assert.equal(typeof runBody['conversation_id'], 'string');
        const conversationId = runBody['conversation_id'] as string;
        const waiting = await request(`/projects/${projectId}/workflow/status`);
        assert.equal(bodyOf(waiting)['current_stage'], 'requirement_clarification');
        const firstMessages = await request(
          `/projects/${projectId}/conversations/${conversationId}/messages?offset=0&limit=20`,
        );
        assert.equal(bodyOf(firstMessages)['total'], 1);
        const continuedOnce = await request(`/projects/${projectId}/workflow/continue`, {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: conversationId,
            message: 'The primary user is a product manager in Shanghai.',
          }),
        });
        assert.equal(continuedOnce.response.status, 202);
        assert.equal(bodyOf(continuedOnce)['current_stage'], 'requirement_clarification');
        const multiRoundMessages = await request(
          `/projects/${projectId}/conversations/${conversationId}/messages?offset=0&limit=20`,
        );
        assert.equal(bodyOf(multiRoundMessages)['total'], 3);
        const continuedTwice = await request(`/projects/${projectId}/workflow/continue`, {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: conversationId,
            message: 'Success means 40 percent of users choose one recommendation.',
          }),
        });
        assert.equal(continuedTwice.response.status, 202);
        assert.equal(bodyOf(continuedTwice)['waiting_for'], 'review');
        const requirementsConversation = bodyOf(continuedTwice)['conversation_id'] as string;
        const requirementDiscussion = await request(`/projects/${projectId}/workflow/discuss`, {
          method: 'POST',
          body: JSON.stringify({
            conversation_id: requirementsConversation,
            message: '首版先保证推荐结果真实可执行，会员功能以后再说。',
          }),
        });
        assert.equal(requirementDiscussion.response.status, 202);
        const synthesis = await request(`/projects/${projectId}/workflow/advance`, {
          method: 'POST',
          body: JSON.stringify({ conversation_id: requirementsConversation }),
        });
        assert.equal(synthesis.response.status, 202);
        assert.equal(bodyOf(synthesis)['current_stage'], 'requirement_synthesis');
        assert.equal(bodyOf(synthesis)['waiting_for'], 'review');
        const synthesisConversation = bodyOf(synthesis)['conversation_id'] as string;
        const mvp = await request(`/projects/${projectId}/workflow/advance`, {
          method: 'POST',
          body: JSON.stringify({ conversation_id: synthesisConversation }),
        });
        assert.equal(mvp.response.status, 202);
        assert.equal(bodyOf(mvp)['current_stage'], 'mvp_compression');
        const mvpConversation = bodyOf(mvp)['conversation_id'] as string;
        const platform = await request(`/projects/${projectId}/workflow/advance`, {
          method: 'POST',
          body: JSON.stringify({ conversation_id: mvpConversation }),
        });
        assert.equal(platform.response.status, 202);
        assert.equal(bodyOf(platform)['current_stage'], 'platform_recommendation');
        const platformConversation = bodyOf(platform)['conversation_id'] as string;
        const completed = await request(`/projects/${projectId}/workflow/advance`, {
          method: 'POST',
          body: JSON.stringify({ conversation_id: platformConversation }),
        });
        assert.equal(completed.response.status, 202);
        assert.equal(bodyOf(completed)['current_stage'], 'completed');

        const standaloneConversation = await request(`/projects/${projectId}/conversations`, {
          method: 'POST',
          body: '{}',
        });
        assert.equal(standaloneConversation.response.status, 201);
        const standaloneId = bodyOf(standaloneConversation)['id'] as string;
        const standaloneMessage = await request(
          `/projects/${projectId}/conversations/${standaloneId}/messages`,
          { method: 'POST', body: JSON.stringify({ content: 'A standalone note.' }) },
        );
        assert.equal(standaloneMessage.response.status, 201);
        const statusAfterStandalone = await request(`/projects/${projectId}/workflow/status`);
        assert.equal(bodyOf(statusAfterStandalone)['conversation_id'], platformConversation);

        const states = await request(`/projects/${projectId}/workflow/states`);
        const statesBody = bodyOf(states);
        assert.equal(statesBody['total'], 9);
        const stateItems = statesBody['items'] as Array<{ status: string }>;
        assert.ok(stateItems.every((state) => state.status === 'completed'));

        const executions = await request(
          `/projects/${projectId}/workflow/executions?offset=0&limit=20`,
        );
        assert.ok(Number(bodyOf(executions)['total']) >= 2);
        const executionId = (bodyOf(executions)['items'] as Array<{ id: string }>)[0]?.id;
        assert.ok(executionId);
        const execution = await request(
          `/projects/${projectId}/workflow/executions/${executionId}`,
        );
        assert.equal(execution.response.status, 200);
        const executionLogs = await request(
          `/projects/${projectId}/workflow/executions/${executionId}/logs?offset=0&limit=100`,
        );
        assert.ok(Number(bodyOf(executionLogs)['total']) > 0);

        const artifacts = await request(`/projects/${projectId}/artifacts`);
        const artifactsBody = bodyOf(artifacts);
        assert.equal(artifactsBody['total'], 11);
        const artifactItems = artifactsBody['items'] as Array<{ type: string; content?: string }>;
        assert.ok(artifactItems.every((artifact) => !('content' in artifact)));
        const prd = artifactItems.find((artifact) => artifact.type === 'prd');
        assert.ok(prd);

        const detail = await request(`/projects/${projectId}/artifacts/${prd.id}`);
        assert.equal(detail.response.status, 200);
        const detailBody = bodyOf(detail);
        assert.equal(typeof detailBody['content'], 'string');
        assert.ok((detailBody['content'] as string).length > 0);
        const download = await fetch(`${base}/projects/${projectId}/artifacts/${prd.id}/download`);
        assert.equal(download.status, 200);
        assert.match(download.headers.get('content-type') ?? '', /text\/markdown/);

        const exportTask = await request(`/projects/${projectId}/export/prd`, {
          method: 'POST',
          body: JSON.stringify({ format: 'markdown', artifact_types: ['prd'] }),
        });
        assert.equal(exportTask.response.status, 202);
        const exportId = bodyOf(exportTask)['id'];
        assert.equal(typeof exportId, 'string');
        const exportStatus = await request(`/projects/${projectId}/export/${exportId}`);
        assert.equal(bodyOf(exportStatus)['status'], 'processing');
        const exportDownload = await request(
          `/projects/${projectId}/export/${exportId}/download?token=test-token`,
        );
        assert.equal(exportDownload.response.status, 404);

        const usage = await request(`/usage/tokens?project_id=${projectId}`);
        const usageBody = bodyOf(usage);
        assert.ok(Number(usageBody['call_count']) > 0);
        assert.ok(Number(usageBody['total_tokens']) > 0);
        assert.ok(Number(usageBody['total_cost']) > 0);

        const logs = await request(`/projects/${projectId}/usage/logs?offset=0&limit=100`);
        assert.ok(Number(bodyOf(logs)['total']) > 0);
        const logItems = bodyOf(logs)['items'] as Array<{ id: string; stage: string }>;
        const logId = logItems[0]?.id;
        assert.ok(logId);
        const log = await request(`/projects/${projectId}/usage/logs/${logId}`);
        assert.equal(log.response.status, 200);
        const feasibilityLog = logItems.find((item) => item.stage === 'feasibility_analysis');
        assert.ok(feasibilityLog);
        const feasibilityDetail = await request(
          `/projects/${projectId}/usage/logs/${feasibilityLog.id}`,
        );
        assert.match(bodyOf(feasibilityDetail)['prompt_text'] as string, /会员功能以后再说/);
      } finally {
        if (projectId) {
          const cleanup = await request(`/projects/${projectId}`, { method: 'DELETE' });
          assert.equal(cleanup.response.status, 204);
        }
      }
    },
  );
});
