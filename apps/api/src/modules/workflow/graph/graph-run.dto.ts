import type { GraphRun } from '@ai-planning/database';

export interface GraphRunResponse {
  id: string;
  status: string;
  current_node: string;
  current_stage: string;
  checkpoint_version: number;
  waiting_for: 'reply' | 'review' | null;
  recovery_available: boolean;
}

export function toGraphRunResponse(run?: GraphRun | null): GraphRunResponse | null {
  if (!run) return null;
  return {
    id: run.id,
    status: run.status,
    current_node: run.current_node,
    current_stage: run.current_stage,
    checkpoint_version: run.checkpoint_version,
    waiting_for:
      run.waiting_for === 'reply' || run.waiting_for === 'review' ? run.waiting_for : null,
    recovery_available: run.status === 'interrupted',
  };
}
