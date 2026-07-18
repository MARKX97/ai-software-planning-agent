import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsageClient } from '../src/components/usage/usage-client';
import { getTokenUsage } from '../src/features/usage/api';

vi.mock('../src/features/usage/api', () => ({ getTokenUsage: vi.fn() }));
vi.mock('../src/components/usage/usage-log-table', () => ({ UsageLogTable: () => null }));

const usage = {
  project_id: 'project-1',
  total_input_tokens: 10,
  total_output_tokens: 20,
  total_tokens: 30,
  total_cost: 5,
  call_count: 1,
  success_count: 1,
  failed_count: 0,
  timeout_count: 0,
  rate_limited_count: 0,
  avg_latency_ms: 10,
  success_rate: 100,
  updated_at: '2026-07-18T00:00:00.000Z',
  by_provider: [],
  by_stage: [],
  cost_limit: { max_cost_per_project: 5, remaining: 0, alert_triggered: true },
};

describe('UsageClient budget state', () => {
  it('shows an exhausted state instead of the 80 percent warning', async () => {
    vi.mocked(getTokenUsage).mockResolvedValue(usage);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <UsageClient projectId="project-1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/模型预算已经用完/)).toBeInTheDocument();
    expect(screen.queryByText(/已经用了预算的 80%/)).not.toBeInTheDocument();
  });
});
