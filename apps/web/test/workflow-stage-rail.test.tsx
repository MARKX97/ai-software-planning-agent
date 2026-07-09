import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageRail } from '../src/components/workflow/stage-rail';
import type { WorkflowStatusResponse } from '../src/types/api';

const status: WorkflowStatusResponse = {
  project_id: 'project-1',
  status: 'active',
  current_stage: 'requirement_clarification',
  stage_display_name: '需求澄清',
  progress: { completed_stages: 1, total_stages: 9, percentage: 11 },
  clarification_questions: ['Who is the target user?'],
  model_status: null,
  error_message: null,
  started_at: null,
  updated_at: '2026-07-09T00:00:00.000Z',
};

describe('StageRail', () => {
  it('renders current workflow status with readable text', () => {
    render(<StageRail states={[]} status={status} />);

    expect(screen.getByText('阶段轨道')).toBeInTheDocument();
    expect(screen.getByText(/当前：需求澄清/)).toBeInTheDocument();
    expect(screen.getByText('需求澄清')).toBeInTheDocument();
  });
});
