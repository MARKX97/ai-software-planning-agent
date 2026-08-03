import { beforeEach, describe, it, vi } from 'vitest';
import {
  downloadArtifact,
  exportPrd,
  getArtifact,
  getExport,
  getExportDownload,
  listArtifacts,
} from '@/features/artifacts/api';
import { createProject, deleteProject, getProject, listProjects } from '@/features/projects/api';
import {
  advanceWorkflow,
  continueWorkflow,
  createConversation,
  discussWorkflow,
  getWorkflowStatus,
  listConversationMessages,
  listWorkflowStates,
  runWorkflow,
} from '@/features/workflow/api';
import { getModelLogDetail, getTokenUsage, listModelLogs } from '@/features/usage/api';
import {
  deleteKnowledgeSource,
  listKnowledgeSources,
  reindexKnowledgeSource,
  uploadKnowledgeSource,
} from '@/features/knowledge/api';
import { apiDownload, apiRequest } from '@/lib/api-client';
import { apiEventStream } from '@/lib/sse-client';

vi.mock('@/lib/api-client', () => ({ apiDownload: vi.fn(), apiRequest: vi.fn() }));
vi.mock('@/lib/sse-client', () => ({ apiEventStream: vi.fn() }));

describe('feature API clients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the PRD export contract', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ id: 'export-1' });
    await exportPrd('project-1');
    expect(apiRequest).toHaveBeenCalledWith('/projects/project-1/export/prd', {
      method: 'POST',
      body: { format: 'markdown', artifact_types: ['prd'] },
    });
  });

  it('maps every non-streaming feature operation to its API contract', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    vi.mocked(apiDownload).mockResolvedValue(new Blob());
    await listProjects({ offset: 20, limit: 10, status: 'completed' });
    await createProject({ name: 'Project', original_idea: 'Idea' });
    await getProject('project-1');
    await deleteProject('project-1');
    await getWorkflowStatus('project-1');
    await listWorkflowStates('project-1');
    await createConversation('project-1');
    await listArtifacts('project-1', 'prd');
    await getArtifact('project-1', 'artifact-1');
    await downloadArtifact('project-1', 'artifact-1');
    await getExport('project-1', 'export-1');
    await getModelLogDetail('project-1', 'log-1');

    expect(vi.mocked(apiRequest).mock.calls).toEqual([
      ['/projects', { query: { offset: 20, limit: 10, status: 'completed' } }],
      ['/projects', { method: 'POST', body: { name: 'Project', original_idea: 'Idea' } }],
      ['/projects/project-1'],
      ['/projects/project-1', { method: 'DELETE' }],
      ['/projects/project-1/workflow/status'],
      ['/projects/project-1/workflow/states'],
      ['/projects/project-1/conversations', { method: 'POST', body: {} }],
      ['/projects/project-1/artifacts', { query: { type: 'prd' } }],
      ['/projects/project-1/artifacts/artifact-1'],
      ['/projects/project-1/export/export-1'],
      ['/projects/project-1/usage/logs/log-1'],
    ]);
    expect(apiDownload).toHaveBeenCalledWith('/projects/project-1/artifacts/artifact-1/download');
  });

  it('sends workflow and usage paths with the expected payloads', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    vi.mocked(apiEventStream).mockResolvedValue({});
    const callbacks = { onDelta: vi.fn() };
    await runWorkflow('project-1', callbacks);
    await continueWorkflow('project-1', {
      conversationId: 'conversation-1',
      message: 'reply',
      graphRunId: 'graph-run-1',
      checkpointVersion: 2,
      ...callbacks,
    });
    await discussWorkflow('project-1', {
      conversationId: 'conversation-1',
      message: 'follow up',
      ...callbacks,
    });
    await advanceWorkflow({
      projectId: 'project-1',
      conversationId: 'conversation-1',
      graphRunId: 'graph-run-1',
      checkpointVersion: 2,
    });
    await listConversationMessages('project-1', 'conversation-1');
    await getTokenUsage('project-1');
    await listModelLogs('project-1', 10, 5);
    await getExportDownload(
      'project-1',
      'export-1',
      '/projects/project-1/export/export-1/download?token=token',
    );
    expect(apiEventStream).toHaveBeenNthCalledWith(1, '/projects/project-1/run', {
      method: 'POST',
      body: {},
      ...callbacks,
    });
    expect(apiEventStream).toHaveBeenNthCalledWith(2, '/projects/project-1/workflow/continue', {
      method: 'POST',
      body: {
        conversation_id: 'conversation-1',
        message: 'reply',
        graph_run_id: 'graph-run-1',
        checkpoint_version: 2,
      },
      ...callbacks,
    });
    expect(apiEventStream).toHaveBeenNthCalledWith(3, '/projects/project-1/workflow/discuss', {
      method: 'POST',
      body: { conversation_id: 'conversation-1', message: 'follow up' },
      ...callbacks,
    });
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/projects/project-1/workflow/advance', {
      method: 'POST',
      body: {
        conversation_id: 'conversation-1',
        graph_run_id: 'graph-run-1',
        checkpoint_version: 2,
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/projects/project-1/conversations/conversation-1/messages',
      { query: { offset: 0, limit: 100 } },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/usage/tokens', {
      query: { project_id: 'project-1' },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/projects/project-1/usage/logs', {
      query: { offset: 10, limit: 5 },
    });
    expect(apiDownload).toHaveBeenCalledWith(
      '/projects/project-1/export/export-1/download?token=token',
    );
  });

  it('maps knowledge source operations and preserves the uploaded file', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    const file = new File(['# Context'], 'context.md', { type: 'text/markdown' });
    await listKnowledgeSources('project-1');
    await uploadKnowledgeSource('project-1', file);
    await reindexKnowledgeSource('project-1', 'source-1');
    await deleteKnowledgeSource('project-1', 'source-1');
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/projects/project-1/knowledge/sources');
    expect(apiRequest).toHaveBeenNthCalledWith(
      2,
      '/projects/project-1/knowledge/sources',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const uploadBody = vi.mocked(apiRequest).mock.calls[1]?.[1]?.body as FormData;
    expect(uploadBody.get('file')).toBe(file);
    expect(apiRequest).toHaveBeenNthCalledWith(
      3,
      '/projects/project-1/knowledge/sources/source-1/reindex',
      { method: 'POST' },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(
      4,
      '/projects/project-1/knowledge/sources/source-1',
      { method: 'DELETE' },
    );
  });
});
