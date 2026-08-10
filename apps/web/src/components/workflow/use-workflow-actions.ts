import { useEffect, useRef, type RefObject } from 'react';
import { regenerateWorkflow, runWorkflow } from '@/features/workflow/api';
import { getUserErrorMessage } from '@/lib/api-client';
import type { WorkflowStatusResponse, WorkflowStreamResponse } from '@/types/api';
import { advanceGraphCheckpoint, submitWorkflowMessage } from './workflow-graph-actions';
import { useWorkflowStream, type WorkflowStreamState } from './use-workflow-stream';

export interface WorkflowActionsInput {
  readonly autoStart: boolean;
  readonly projectId: string;
  readonly conversationId: string | null;
  readonly status: WorkflowStatusResponse | undefined;
  readonly refresh: () => Promise<void>;
  readonly onDone: (result: WorkflowStreamResponse) => void;
}

export interface WorkflowActions {
  readonly actionError: string | null;
  readonly advanceCheckpoint: () => Promise<void>;
  readonly answer: string;
  readonly busy: boolean;
  readonly pendingUserMessage: string | null;
  readonly setAnswer: (value: string) => void;
  readonly startWorkflow: () => Promise<void>;
  readonly regenerateArtifacts: () => Promise<void>;
  readonly streamingReply: string | null;
  readonly submitReply: () => Promise<void>;
}

export function useWorkflowActions(input: WorkflowActionsInput): WorkflowActions {
  const stream = useWorkflowStream(input);
  const autoStartedRef = useRef(false);
  async function startWorkflow(): Promise<void> {
    await stream.execute((callbacks) => runWorkflow(input.projectId, callbacks), null);
  }
  useAutoStart(input, autoStartedRef, startWorkflow);
  return {
    actionError: stream.actionError,
    advanceCheckpoint: () => advanceCheckpoint(input, stream),
    answer: stream.answer,
    busy: stream.busy,
    pendingUserMessage: stream.pendingUserMessage,
    regenerateArtifacts: () => runRegeneration(input, stream),
    setAnswer: stream.setAnswer,
    startWorkflow,
    streamingReply: stream.streamingReply,
    submitReply: () => submitReply(input, stream),
  };
}

async function submitReply(
  input: WorkflowActionsInput,
  stream: WorkflowStreamState,
): Promise<void> {
  const message = stream.answer.trim();
  if (!message) return stream.setActionError('请输入澄清回复。');
  if (!input.conversationId || !input.status?.waiting_for)
    return stream.setActionError('当前没有可继续的讨论。');
  const graphRun = input.status.graph_run;
  if (input.status.waiting_for === 'reply' && graphRun && !graphRun.recovery_available)
    return stream.setActionError('当前恢复点不可用，请刷新后重试。');
  await stream.execute(
    (callbacks) =>
      submitWorkflowMessage({
        projectId: input.projectId,
        conversationId: input.conversationId ?? '',
        message,
        graphRun,
        resume: input.status?.waiting_for === 'reply',
        callbacks,
      }),
    message,
  );
}

async function advanceCheckpoint(
  input: WorkflowActionsInput,
  stream: WorkflowStreamState,
): Promise<void> {
  const graphRun = input.status?.graph_run;
  if (!input.conversationId || (graphRun && !graphRun.recovery_available))
    return stream.setActionError('当前没有可确认的讨论。');
  stream.setBusy(true);
  stream.setActionError(null);
  try {
    await advanceGraphCheckpoint(input.projectId, input.conversationId, graphRun ?? null);
    await input.refresh();
  } catch (error) {
    stream.setActionError(getUserErrorMessage(error, '暂时无法进入下一环节，请稍后重试。'));
  } finally {
    stream.setBusy(false);
  }
}

async function runRegeneration(
  input: WorkflowActionsInput,
  stream: WorkflowStreamState,
): Promise<void> {
  stream.setBusy(true);
  stream.setActionError(null);
  try {
    await regenerateWorkflow(input.projectId);
    await input.refresh();
  } catch (error) {
    stream.setActionError(getUserErrorMessage(error, '受影响的产物暂时无法更新，请稍后重试。'));
  } finally {
    stream.setBusy(false);
  }
}

function useAutoStart(
  input: WorkflowActionsInput,
  started: RefObject<boolean>,
  start: () => Promise<void>,
): void {
  useEffect(() => {
    if (input.autoStart && input.status?.current_stage === 'init' && !started.current) {
      started.current = true;
      void start();
    }
  }, [input.autoStart, input.status?.current_stage]);
}
