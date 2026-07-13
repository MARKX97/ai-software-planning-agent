import { useEffect, useRef, useState } from 'react';
import {
  advanceWorkflow,
  continueWorkflow,
  discussWorkflow,
  runWorkflow,
  type WorkflowStreamCallbacks,
} from '@/features/workflow/api';
import { getUserErrorMessage } from '@/lib/api-client';
import type { WorkflowStatusResponse, WorkflowStreamResponse } from '@/types/api';

interface WorkflowActionsInput {
  readonly autoStart: boolean;
  readonly projectId: string;
  readonly conversationId: string | null;
  readonly status: WorkflowStatusResponse | undefined;
  readonly refresh: () => Promise<void>;
  readonly onDone: (result: WorkflowStreamResponse) => void;
}

type StreamCall = (callbacks: WorkflowStreamCallbacks) => Promise<WorkflowStreamResponse>;

interface WorkflowActions {
  readonly actionError: string | null;
  readonly advanceCheckpoint: () => Promise<void>;
  readonly answer: string;
  readonly busy: boolean;
  readonly pendingUserMessage: string | null;
  readonly setAnswer: (value: string) => void;
  readonly startWorkflow: () => Promise<void>;
  readonly streamingReply: string | null;
  readonly submitReply: () => Promise<void>;
}

export function useWorkflowActions(input: WorkflowActionsInput): WorkflowActions {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) abortRef.current?.abort();
      });
    };
  }, []);
  useEffect(() => {
    if (input.autoStart && input.status?.current_stage === 'init' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void startWorkflow();
    }
  }, [input.autoStart, input.status?.current_stage]);

  function queueDelta(content: string): void {
    bufferRef.current += content;
    if (timerRef.current) return;
    timerRef.current = setTimeout(flushDeltas, 50);
  }

  function flushDeltas(): void {
    const content = bufferRef.current;
    bufferRef.current = '';
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (content) setStreamingReply((current) => `${current ?? ''}${content}`);
  }

  function resetStream(userMessage: string | null): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    bufferRef.current = '';
    setPendingUserMessage(userMessage);
    setStreamingReply('');
  }

  async function executeStream(call: StreamCall, userMessage: string | null): Promise<void> {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setBusy(true);
    setActionError(null);
    resetStream(userMessage);
    try {
      const result = await call({ onDelta: queueDelta, signal: controller.signal });
      flushDeltas();
      input.onDone(result);
      if (userMessage) setAnswer('');
      setPendingUserMessage(null);
      setStreamingReply(null);
      try {
        await input.refresh();
      } catch (error) {
        setActionError(getUserErrorMessage(error, '回复已保存，但刷新记录失败，请稍后重试。'));
      }
    } catch (error) {
      flushDeltas();
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setActionError(getUserErrorMessage(error, '回复生成失败，请稍后重试。'));
        await input.refresh().catch(() => undefined);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  async function startWorkflow(): Promise<void> {
    await executeStream((callbacks) => runWorkflow(input.projectId, callbacks), null);
  }

  async function submitReply(): Promise<void> {
    const message = answer.trim();
    if (!message) {
      setActionError('请输入澄清回复。');
      return;
    }
    if (!input.conversationId || !input.status?.waiting_for) {
      setActionError('当前没有可继续的讨论。');
      return;
    }
    const submit = input.status.waiting_for === 'reply' ? continueWorkflow : discussWorkflow;
    await executeStream(
      (callbacks) =>
        submit(input.projectId, {
          conversationId: input.conversationId ?? '',
          message,
          ...callbacks,
        }),
      message,
    );
  }

  async function advanceCheckpoint(): Promise<void> {
    if (!input.conversationId) {
      setActionError('当前没有可确认的讨论。');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await advanceWorkflow(input.projectId, input.conversationId);
      await input.refresh();
    } catch (error) {
      setActionError(getUserErrorMessage(error, '暂时无法进入下一环节，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  return {
    actionError,
    advanceCheckpoint,
    answer,
    busy,
    pendingUserMessage,
    setAnswer,
    startWorkflow,
    streamingReply,
    submitReply,
  };
}
