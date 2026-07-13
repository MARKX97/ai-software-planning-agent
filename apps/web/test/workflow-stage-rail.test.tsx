import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { StageRail } from '../src/components/workflow/stage-rail';
import type { WorkflowStateResponse, WorkflowStatusResponse } from '../src/types/api';

const status: WorkflowStatusResponse = {
  project_id: 'project-1',
  conversation_id: null,
  status: 'active',
  current_stage: 'requirement_clarification',
  stage_display_name: '需求澄清',
  progress: { completed_stages: 1, total_stages: 9, percentage: 11 },
  waiting_for: 'reply',
  next_stage: 'multi_model_analysis',
  clarification_questions: ['Who is the target user?'],
  model_status: null,
  error_message: null,
  started_at: null,
  updated_at: '2026-07-09T00:00:00.000Z',
};

describe('StageRail', () => {
  it('renders current workflow status with readable text', () => {
    render(<StageRail states={[]} status={status} />);

    expect(screen.getByText('这次走到哪了')).toBeInTheDocument();
    expect(screen.getByText(/现在在：补几个关键细节/)).toBeInTheDocument();
    expect(screen.getByText('补几个关键细节')).toBeInTheDocument();
  });

  it('expands a stage and shows its structured record', async () => {
    const state: WorkflowStateResponse = {
      id: 'state-1',
      project_id: 'project-1',
      stage: 'requirement_analysis',
      status: 'completed',
      display_name: '需求分析',
      progress: { completed_stages: 1, total_stages: 9, percentage: 11 },
      data_json: {
        project_summary: '帮助用户更快决定今晚吃什么。',
        _workflow: { waiting_for: 'review' },
      },
      error_message: null,
      started_at: '2026-07-09T00:00:00.000Z',
      completed_at: '2026-07-09T00:00:01.000Z',
      created_at: '2026-07-09T00:00:00.000Z',
    };
    render(<StageRail states={[state]} status={status} />);

    const summary = screen.getByText('先把想法说清楚').closest('summary');
    expect(summary).not.toBeNull();
    await userEvent.click(summary!);
    expect(summary?.parentElement).toHaveAttribute('open');
    expect(screen.getByText('帮助用户更快决定今晚吃什么。')).toBeInTheDocument();
    expect(screen.queryByText('_workflow')).not.toBeInTheDocument();
  });
});
