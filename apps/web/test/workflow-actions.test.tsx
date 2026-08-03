import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflowActions } from '../src/components/workflow/use-workflow-actions';
import {
  advanceWorkflow,
  continueWorkflow,
  discussWorkflow,
  runWorkflow,
} from '../src/features/workflow/api';

vi.mock('../src/features/workflow/api', () => ({
  advanceWorkflow: vi.fn(),
  continueWorkflow: vi.fn(),
  discussWorkflow: vi.fn(),
  runWorkflow: vi.fn(),
}));

const streamResult = {
  assistant_message: { id: 'message-1', conversation_id: 'conversation-1' },
  status: { current_stage: 'requirement_clarification' },
} as never;
const graphRun = {
  id: '11111111-1111-4111-8111-111111111111',
  checkpoint_version: 2,
  recovery_available: true,
};

function setup(
  waitingFor: 'reply' | 'review' | null = 'reply',
  conversationId: string | null = 'conversation-1',
) {
  const refresh = vi.fn(async () => undefined);
  const onDone = vi.fn();
  const hook = renderHook(() =>
    useWorkflowActions({
      autoStart: false,
      projectId: 'project-1',
      conversationId,
      status: {
        current_stage: 'requirement_clarification',
        waiting_for: waitingFor,
        graph_run: graphRun,
      } as never,
      refresh,
      onDone,
    }),
  );
  return { ...hook, refresh, onDone };
}

describe('useWorkflowActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runWorkflow).mockResolvedValue(streamResult);
    vi.mocked(continueWorkflow).mockResolvedValue(streamResult);
    vi.mocked(discussWorkflow).mockResolvedValue(streamResult);
    vi.mocked(advanceWorkflow).mockResolvedValue({} as never);
  });

  it('validates empty and inactive replies before making a request', async () => {
    const empty = setup();
    await act(() => empty.result.current.submitReply());
    expect(empty.result.current.actionError).toBe('请输入澄清回复。');
    const inactive = setup(null, null);
    act(() => inactive.result.current.setAnswer('answer'));
    await act(() => inactive.result.current.submitReply());
    expect(inactive.result.current.actionError).toBe('当前没有可继续的讨论。');
    expect(continueWorkflow).not.toHaveBeenCalled();
  });

  it('uses continue for replies and clears local stream state after success', async () => {
    const hook = setup('reply');
    act(() => hook.result.current.setAnswer('  answer  '));
    await act(() => hook.result.current.submitReply());
    expect(continueWorkflow).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        conversationId: 'conversation-1',
        message: 'answer',
        graphRunId: graphRun.id,
        checkpointVersion: 2,
      }),
    );
    expect(hook.onDone).toHaveBeenCalledWith(streamResult);
    expect(hook.refresh).toHaveBeenCalled();
    expect(hook.result.current.answer).toBe('');
    expect(hook.result.current.busy).toBe(false);
  });

  it('uses discuss for reviews and exposes safe request failures', async () => {
    vi.mocked(discussWorkflow).mockRejectedValueOnce(new Error('fetch failed'));
    const hook = setup('review');
    act(() => hook.result.current.setAnswer('feedback'));
    await act(() => hook.result.current.submitReply());
    expect(discussWorkflow).toHaveBeenCalled();
    expect(hook.result.current.actionError).toMatch(/无法连接到服务/);
    await waitFor(() => expect(hook.result.current.busy).toBe(false));
  });

  it('advances checkpoints and handles missing conversations', async () => {
    const missing = setup('review', null);
    await act(() => missing.result.current.advanceCheckpoint());
    expect(missing.result.current.actionError).toBe('当前没有可确认的讨论。');
    const hook = setup('review');
    await act(() => hook.result.current.advanceCheckpoint());
    expect(advanceWorkflow).toHaveBeenCalledWith({
      projectId: 'project-1',
      conversationId: 'conversation-1',
      graphRunId: graphRun.id,
      checkpointVersion: 2,
    });
    expect(hook.refresh).toHaveBeenCalled();
  });
});
