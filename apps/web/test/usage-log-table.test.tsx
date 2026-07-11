import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageLogTable } from '../src/components/usage/usage-log-table';
import { getModelLogDetail, listModelLogs } from '../src/features/usage/api';
import type { ModelExecutionLogResponse } from '../src/types/api';

vi.mock('../src/features/usage/api', () => ({
  getModelLogDetail: vi.fn(),
  listModelLogs: vi.fn(),
}));

const log: ModelExecutionLogResponse = {
  id: 'log-1',
  project_id: 'project-1',
  execution_id: 'execution-1',
  stage: 'requirement_analysis',
  provider_name: 'deepseek',
  model_id: 'demo-model',
  status: 'success',
  attempt_number: 0,
  prompt_version_id: null,
  input_tokens: 10,
  output_tokens: 20,
  cost_input: 0.001,
  cost_output: 0.002,
  cost_total: 0.003,
  latency_ms: 12,
  error_code: null,
  error_message: null,
  created_at: '2026-07-09T00:00:00.000Z',
};

describe('UsageLogTable', () => {
  beforeEach(() => {
    vi.mocked(listModelLogs).mockResolvedValue({ items: [log], total: 1, offset: 0, limit: 20 });
    vi.mocked(getModelLogDetail).mockResolvedValue({
      ...log,
      prompt_text: 'demo prompt',
      response_text: 'demo response',
      structured_output: null,
    });
  });

  it('opens the selected log directly below its row', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UsageLogTable projectId="project-1" />
      </QueryClientProvider>,
    );

    const button = await screen.findByRole('button', { name: '看看细节' });
    await userEvent.click(button);
    expect(await screen.findByText('demo prompt')).toBeInTheDocument();
    expect(screen.getByText('demo response')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
