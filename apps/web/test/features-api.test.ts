import { beforeEach, describe, it, vi } from 'vitest';
import { exportPrd, getExportDownload } from '@/features/artifacts/api';
import {
  advanceWorkflow,
  continueWorkflow,
  discussWorkflow,
  listConversationMessages,
  runWorkflow,
} from '@/features/workflow/api';
import { getTokenUsage, listModelLogs } from '@/features/usage/api';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

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

  it('sends workflow and usage paths with the expected payloads', async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await runWorkflow('project-1');
    await continueWorkflow('project-1', 'conversation-1', 'reply');
    await discussWorkflow('project-1', 'conversation-1', 'follow up');
    await advanceWorkflow('project-1', 'conversation-1');
    await listConversationMessages('project-1', 'conversation-1');
    await getTokenUsage('project-1');
    await listModelLogs('project-1', 10, 5);
    await getExportDownload('project-1', 'export-1', 'token');
    expect(apiRequest).toHaveBeenNthCalledWith(1, '/projects/project-1/run', {
      method: 'POST',
      body: {},
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/projects/project-1/workflow/continue', {
      method: 'POST',
      body: { conversation_id: 'conversation-1', message: 'reply' },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/projects/project-1/workflow/discuss', {
      method: 'POST',
      body: { conversation_id: 'conversation-1', message: 'follow up' },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(4, '/projects/project-1/workflow/advance', {
      method: 'POST',
      body: { conversation_id: 'conversation-1' },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(
      5,
      '/projects/project-1/conversations/conversation-1/messages',
      { query: { offset: 0, limit: 100 } },
    );
    expect(apiRequest).toHaveBeenNthCalledWith(6, '/usage/tokens', {
      query: { project_id: 'project-1' },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(7, '/projects/project-1/usage/logs', {
      query: { offset: 10, limit: 5 },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(8, '/projects/project-1/export/export-1/download', {
      query: { token: 'token' },
    });
  });
});
