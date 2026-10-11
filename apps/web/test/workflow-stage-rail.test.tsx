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
  decision_snapshots: [],
  quality_report: null,
  error_message: null,
  started_at: null,
  updated_at: '2026-07-09T00:00:00.000Z',
  graph_run: null,
  regeneration: null,
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

  it('turns a stored JSON result into named Chinese fields', async () => {
    const state: WorkflowStateResponse = {
      id: 'state-2',
      project_id: 'project-1',
      stage: 'requirement_synthesis',
      status: 'completed',
      display_name: '需求综合',
      progress: { completed_stages: 3, total_stages: 9, percentage: 33 },
      data_json: {
        content: '{"project_name":"宠物奇遇","executive_summary":"为宠物主人生成动画故事。"}',
      },
      error_message: null,
      started_at: '2026-07-09T00:00:00.000Z',
      completed_at: '2026-07-09T00:00:01.000Z',
      created_at: '2026-07-09T00:00:00.000Z',
    };
    render(<StageRail states={[state]} status={status} />);

    const summary = screen.getByText('收成一份共识').closest('summary');
    expect(summary).not.toBeNull();
    await userEvent.click(summary!);
    expect(screen.getByText('项目名称')).toBeVisible();
    expect(screen.getByText('宠物奇遇')).toBeVisible();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('hides an incomplete JSON result behind a Chinese recovery message', async () => {
    const state: WorkflowStateResponse = {
      id: 'state-3',
      project_id: 'project-1',
      stage: 'requirement_synthesis',
      status: 'completed',
      display_name: '需求综合',
      progress: { completed_stages: 3, total_stages: 9, percentage: 33 },
      data_json: { content: '{"project_name":"宠物奇遇"' },
      error_message: null,
      started_at: '2026-07-09T00:00:00.000Z',
      completed_at: '2026-07-09T00:00:01.000Z',
      created_at: '2026-07-09T00:00:00.000Z',
    };
    render(<StageRail states={[state]} status={status} />);

    const summary = screen.getByText('收成一份共识').closest('summary');
    expect(summary).not.toBeNull();
    await userEvent.click(summary!);
    expect(screen.getByText(/没有完整生成/)).toBeVisible();
    expect(screen.queryByText('project_name')).not.toBeInTheDocument();
  });

  it('translates internal fields and enum values into Chinese', async () => {
    const state: WorkflowStateResponse = {
      id: 'state-4',
      project_id: 'project-1',
      stage: 'feasibility_analysis',
      status: 'completed',
      display_name: '可行性分析',
      progress: { completed_stages: 5, total_stages: 9, percentage: 55 },
      data_json: {
        content:
          '{"technical_feasibility":"medium","technical_risks":[{"id":"TR-1","severity":"high","category":"privacy_and_security"}]}',
      },
      error_message: null,
      started_at: '2026-07-09T00:00:00.000Z',
      completed_at: '2026-07-09T00:00:01.000Z',
      created_at: '2026-07-09T00:00:00.000Z',
    };
    render(<StageRail states={[state]} status={status} />);

    const summary = screen.getByText('看看能不能做').closest('summary');
    expect(summary).not.toBeNull();
    await userEvent.click(summary!);
    expect(screen.getByText('技术可行性')).toBeVisible();
    expect(screen.getByText('中')).toBeVisible();
    expect(screen.getByText('严重程度')).toBeVisible();
    expect(screen.getByText('高')).toBeVisible();
    expect(screen.getByText('隐私与安全')).toBeVisible();
    expect(screen.queryByText('medium')).not.toBeInTheDocument();
  });
});
