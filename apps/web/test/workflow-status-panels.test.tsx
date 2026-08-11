import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowStatusPanels } from '../src/components/workflow/workflow-status-panels';
import type { WorkflowStatusResponse } from '../src/types/api';

describe('WorkflowStatusPanels V2 insights', () => {
  it('shows confirmed decisions and an honest quality warning', () => {
    render(
      <WorkflowStatusPanels
        actionError={null}
        busy={false}
        failureMessage={null}
        onStart={vi.fn()}
        onRegenerate={vi.fn()}
        status={status}
      />,
    );

    expect(screen.getByText('已经确认的决定')).toBeInTheDocument();
    expect(screen.getByText('首版不做团队协作')).toBeInTheDocument();
    expect(screen.getByText('产物需要复核')).toBeInTheDocument();
    expect(screen.getByText(/已生成 10\/11 类产物/)).toBeInTheDocument();
  });

  it('shows redacted Tool trace and regenerates only the reported impact', () => {
    const onRegenerate = vi.fn();
    render(
      <WorkflowStatusPanels
        actionError={null}
        busy={false}
        failureMessage={null}
        onRegenerate={onRegenerate}
        onStart={vi.fn()}
        status={{
          ...status,
          graph_run: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'completed',
            current_node: 'end',
            current_stage: 'completed',
            checkpoint_version: 4,
            waiting_for: null,
            recovery_available: false,
            tool_call_count: 1,
            retrieval_summary: '1 次 Tool · 2 条结果',
            interrupt_reason: null,
            tool_steps: [
              {
                id: '550e8400-e29b-41d4-a716-446655440001',
                node: 'choose_action',
                stage: 'planning_generation',
                tool: 'searchKnowledge',
                call_number: 1,
                status: 'success',
                result_count: 2,
                duration_ms: 4,
                summary: '2 条知识证据',
                error_code: null,
                created_at: '2026-08-10T00:00:00.000Z',
              },
            ],
          },
          regeneration: {
            affected_artifacts: ['prd', 'backend_spec'],
            source_ids: ['550e8400-e29b-41d4-a716-446655440002'],
          },
        }}
      />,
    );
    expect(screen.getByText(/1 次 Tool · 2 条结果/)).toBeInTheDocument();
    expect(screen.getByText(/PRD、后端规格/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '更新受影响产物' }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('offers recovery when a running Graph lease has expired', () => {
    const onStart = vi.fn();
    render(
      <WorkflowStatusPanels
        actionError={null}
        busy={false}
        failureMessage={null}
        onRegenerate={vi.fn()}
        onStart={onStart}
        status={{
          ...status,
          status: 'active',
          current_stage: 'risk_analysis',
          graph_run: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'running',
            current_node: 'risk_analysis',
            current_stage: 'risk_analysis',
            checkpoint_version: 2,
            waiting_for: null,
            recovery_available: true,
            tool_call_count: 0,
            retrieval_summary: null,
            interrupt_reason: null,
            tool_steps: [],
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '恢复执行' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

const status: WorkflowStatusResponse = {
  project_id: 'project-1',
  conversation_id: null,
  status: 'completed',
  current_stage: 'completed',
  stage_display_name: '已完成',
  progress: { completed_stages: 9, total_stages: 9, percentage: 100 },
  waiting_for: null,
  next_stage: null,
  clarification_questions: null,
  model_status: null,
  decision_snapshots: [
    {
      stage: 'requirement_synthesis',
      summary: '聚焦个人用户',
      decisions: ['首版不做团队协作'],
      user_feedback: [],
      confirmed_at: '2026-07-22T00:00:00.000Z',
    },
  ],
  quality_report: {
    status: 'warning',
    expected_artifacts: 11,
    generated_artifacts: 10,
    checks: [
      {
        id: 'artifact_coverage',
        label: '产物覆盖',
        status: 'warning',
        affected_artifacts: ['backend_spec'],
        message: '10/11 类产物已生成',
      },
    ],
    revised_artifacts: ['prd'],
  },
  error_message: null,
  started_at: '2026-07-22T00:00:00.000Z',
  updated_at: '2026-07-22T00:01:00.000Z',
  graph_run: null,
  regeneration: null,
};
