import type { Response } from 'express';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { LLMError } from '@ai-planning/llm-orchestrator';
import type { MessageResponse } from '../conversations/conversations.dto.js';
import type { WorkflowStatusResponse } from './workflow-response.dto.js';
import type { WorkflowStreamError, WorkflowStreamEvent } from '@ai-planning/shared';

const HEARTBEAT_MS = 15000;
type ApiWorkflowStreamEvent = WorkflowStreamEvent<MessageResponse, WorkflowStatusResponse>;

export class WorkflowSse {
  readonly signal: AbortSignal;
  private readonly abortController = new AbortController();
  private heartbeat: NodeJS.Timeout | null = null;
  private ended = false;

  constructor(private readonly response: Response) {
    this.signal = this.abortController.signal;
    response.on('close', () => {
      if (!this.ended) this.abortController.abort();
      this.stopHeartbeat();
    });
  }

  open(): void {
    this.response.status(200);
    this.response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    this.response.flushHeaders();
    this.heartbeat = setInterval(() => this.write(': heartbeat\n\n'), HEARTBEAT_MS);
  }

  delta(content: string): void {
    this.event({ event: 'delta', data: { content } });
  }

  done(assistantMessage: MessageResponse, status: WorkflowStatusResponse): void {
    this.event({
      event: 'done',
      data: { assistant_message: assistantMessage, status },
    });
    this.end();
  }

  fail(error: unknown): void {
    const payload = streamError(error);
    this.event({
      event: 'error',
      data: { error: payload, retryable: isRetryable(payload.code) },
    });
    this.end();
  }

  private event(event: ApiWorkflowStreamEvent): void {
    this.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
  }

  private write(content: string): void {
    if (!this.ended && !this.response.destroyed) this.response.write(content);
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.stopHeartbeat();
    if (!this.response.destroyed) this.response.end();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

function streamError(error: unknown): WorkflowStreamError {
  if (error instanceof AppException) {
    const response = error.getResponse() as WorkflowStreamError;
    return response;
  }
  if (error instanceof LLMError) {
    return { code: error.code, message: llmMessage(error.code) };
  }
  return { code: ErrorCode.INTERNAL_ERROR, message: '服务暂时不可用，请稍后重试。' };
}

function llmMessage(code: string): string {
  if (code === 'LLM_TIMEOUT') return '模型响应超时，请稍后重试。';
  if (code === 'RATE_LIMITED') return '请求过于频繁，请稍后再试。';
  if (code === 'LLM_CANCELLED') return '回复已取消。';
  return '模型服务暂时不可用，请稍后重试。';
}

function isRetryable(code: string): boolean {
  return ['LLM_TIMEOUT', 'RATE_LIMITED', 'LLM_NETWORK_ERROR'].includes(code);
}
