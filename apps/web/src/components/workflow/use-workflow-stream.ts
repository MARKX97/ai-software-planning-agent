import { useEffect, useRef, useState, type RefObject } from 'react';
import type { WorkflowStreamCallbacks } from '@/features/workflow/api';
import { getUserErrorMessage } from '@/lib/api-client';
import type { WorkflowStreamResponse } from '@/types/api';
import type { WorkflowActionsInput } from './use-workflow-actions';

type StreamCall = (callbacks: WorkflowStreamCallbacks) => Promise<WorkflowStreamResponse>;

export interface WorkflowStreamState {
  actionError: string | null;
  answer: string;
  busy: boolean;
  execute: (call: StreamCall, userMessage: string | null) => Promise<void>;
  pendingUserMessage: string | null;
  setActionError: (value: string | null) => void;
  setAnswer: (value: string) => void;
  setBusy: (value: boolean) => void;
  streamingReply: string | null;
}

export function useWorkflowStream(input: WorkflowActionsInput): WorkflowStreamState {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const buffer = useStreamBuffer(setPendingUserMessage, setStreamingReply);
  useAbortOnUnmount(abortRef, mountedRef);
  return {
    actionError,
    answer,
    busy,
    execute: (call, userMessage) =>
      executeStream({
        abortRef,
        buffer,
        call,
        input,
        setActionError,
        setAnswer,
        setBusy,
        userMessage,
      }),
    pendingUserMessage,
    setActionError,
    setAnswer,
    setBusy,
    streamingReply,
  };
}

interface StreamBuffer {
  finish: () => void;
  flush: () => void;
  queue: (content: string) => void;
  reset: (userMessage: string | null) => void;
}

function useStreamBuffer(
  setPending: (value: string | null) => void,
  setReply: (value: string | null | ((current: string | null) => string)) => void,
): StreamBuffer {
  const contentRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flush(): void {
    const content = contentRef.current;
    contentRef.current = '';
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (content) setReply((current) => `${current ?? ''}${content}`);
  }
  function queue(content: string): void {
    contentRef.current += content;
    if (!timerRef.current) timerRef.current = setTimeout(flush, 50);
  }
  function reset(userMessage: string | null): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    contentRef.current = '';
    setPending(userMessage);
    setReply('');
  }
  function finish(): void {
    setPending(null);
    setReply(null);
  }
  return { finish, flush, queue, reset };
}

interface ExecuteStreamInput {
  abortRef: RefObject<AbortController | null>;
  buffer: StreamBuffer;
  call: StreamCall;
  input: WorkflowActionsInput;
  setActionError: (value: string | null) => void;
  setAnswer: (value: string) => void;
  setBusy: (value: boolean) => void;
  userMessage: string | null;
}

async function executeStream(args: ExecuteStreamInput): Promise<void> {
  const controller = new AbortController();
  args.abortRef.current?.abort();
  args.abortRef.current = controller;
  args.setBusy(true);
  args.setActionError(null);
  args.buffer.reset(args.userMessage);
  try {
    const result = await args.call({ onDelta: args.buffer.queue, signal: controller.signal });
    args.buffer.flush();
    args.input.onDone(result);
    if (args.userMessage) args.setAnswer('');
    args.buffer.finish();
    await refreshAfterStream(args.input, args.setActionError);
  } catch (error) {
    await handleStreamError(error, args);
  } finally {
    if (args.abortRef.current === controller) args.abortRef.current = null;
    args.setBusy(false);
  }
}

async function refreshAfterStream(
  input: WorkflowActionsInput,
  setError: (value: string | null) => void,
): Promise<void> {
  try {
    await input.refresh();
  } catch (error) {
    setError(getUserErrorMessage(error, '回复已保存，但刷新记录失败，请稍后重试。'));
  }
}

async function handleStreamError(error: unknown, args: ExecuteStreamInput): Promise<void> {
  args.buffer.flush();
  if (error instanceof Error && error.name === 'AbortError') return;
  args.setActionError(getUserErrorMessage(error, '回复生成失败，请稍后重试。'));
  await args.input.refresh().catch(() => undefined);
}

function useAbortOnUnmount(
  abortRef: RefObject<AbortController | null>,
  mountedRef: RefObject<boolean>,
): void {
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) abortRef.current?.abort();
      });
    };
  }, [abortRef, mountedRef]);
}
