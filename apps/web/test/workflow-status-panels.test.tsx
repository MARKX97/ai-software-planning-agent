import React from 'react';
import { render, screen } from '@testing-library/react';
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
        status={status}
      />,
    );

    expect(screen.getByText('已经确认的决定')).toBeInTheDocument();
    expect(screen.getByText('首版不做团队协作')).toBeInTheDocument();
    expect(screen.getByText('产物需要复核')).toBeInTheDocument();
    expect(screen.getByText(/已生成 10\/11 类产物/)).toBeInTheDocument();
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
};
