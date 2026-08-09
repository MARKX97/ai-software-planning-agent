import type { GraphRun, ToolStep } from '@ai-planning/database';

export interface ToolStepResponse {
  id: string;
  node: string;
  stage: string;
  tool: string;
  call_number: number;
  status: 'running' | 'success' | 'failed' | 'rejected';
  result_count: number;
  duration_ms: number | null;
  summary: string | null;
  error_code: string | null;
  created_at: string;
}

export interface GraphRunResponse {
  id: string;
  status: string;
  current_node: string;
  current_stage: string;
  checkpoint_version: number;
  waiting_for: 'reply' | 'review' | null;
  recovery_available: boolean;
  tool_call_count: number;
  retrieval_summary: string | null;
  interrupt_reason: 'reply' | 'review' | null;
  tool_steps: ToolStepResponse[];
}

type GraphRunWithTools = GraphRun & { tool_steps?: ToolStep[] };

export function toGraphRunResponse(run?: GraphRunWithTools | null): GraphRunResponse | null {
  if (!run) return null;
  const steps = run.tool_steps ?? [];
  const toolCallCount = steps.filter((step) => step.status !== 'rejected').length;
  const resultCount = steps.reduce((sum, step) => sum + step.result_count, 0);
  return {
    id: run.id,
    status: run.status,
    current_node: run.current_node,
    current_stage: run.current_stage,
    checkpoint_version: run.checkpoint_version,
    waiting_for:
      run.waiting_for === 'reply' || run.waiting_for === 'review' ? run.waiting_for : null,
    recovery_available: run.status === 'interrupted',
    tool_call_count: toolCallCount,
    retrieval_summary:
      toolCallCount > 0 ? `${toolCallCount} 次 Tool · ${resultCount} 条结果` : null,
    interrupt_reason:
      run.waiting_for === 'reply' || run.waiting_for === 'review' ? run.waiting_for : null,
    tool_steps: steps.map(toToolStepResponse),
  };
}

function toToolStepResponse(step: ToolStep): ToolStepResponse {
  return {
    id: step.id,
    node: step.node,
    stage: step.stage,
    tool: step.tool,
    call_number: step.call_number,
    status: toolStatus(step.status),
    result_count: step.result_count,
    duration_ms: step.duration_ms,
    summary: resultSummary(step.result_json),
    error_code: step.error_code,
    created_at: step.created_at.toISOString(),
  };
}

function toolStatus(value: string): ToolStepResponse['status'] {
  return ['running', 'success', 'failed', 'rejected'].includes(value)
    ? (value as ToolStepResponse['status'])
    : 'failed';
}

function resultSummary(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = (value as Record<string, unknown>)['summary'];
  return typeof summary === 'string' ? summary.slice(0, 300) : null;
}
