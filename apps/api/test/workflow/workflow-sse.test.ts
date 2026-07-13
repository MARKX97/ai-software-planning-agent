import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';
import { LLMTimeoutError } from '@ai-planning/llm-orchestrator';
import { WorkflowSse } from '../../src/modules/workflow/workflow-sse.js';
import type { MessageResponse } from '../../src/modules/conversations/conversations.dto.js';
import type { WorkflowStatusResponse } from '../../src/modules/workflow/workflow-response.dto.js';

class FakeResponse extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  destroyed = false;
  ended = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  set(headers: Record<string, string>): this {
    this.headers = headers;
    return this;
  }

  flushHeaders(): void {}

  write(content: string): boolean {
    this.chunks.push(content);
    return true;
  }

  end(): this {
    this.ended = true;
    return this;
  }
}

const message = {
  id: 'message-id',
  conversation_id: 'conversation-id',
  role: 'assistant',
  content: '完整回复',
  metadata: null,
  created_at: '2026-07-13T00:00:00.000Z',
} satisfies MessageResponse;

const status = {
  project_id: 'project-id',
  conversation_id: 'conversation-id',
  status: 'active',
  current_stage: 'requirement_clarification',
  stage_display_name: '需求澄清',
  progress: { completed_stages: 1, total_stages: 9, percentage: 11 },
  waiting_for: 'reply',
  next_stage: null,
  clarification_questions: [],
  model_status: null,
  error_message: null,
  started_at: null,
  updated_at: '2026-07-13T00:00:00.000Z',
} satisfies WorkflowStatusResponse;

describe('WorkflowSse', () => {
  it('writes delta then exactly one done event with anti-buffering headers', () => {
    const response = new FakeResponse();
    const stream = new WorkflowSse(response as unknown as Response);
    stream.open();
    stream.delta('正在生成');
    stream.done(message, status);

    const output = response.chunks.join('');
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-cache, no-transform');
    assert.equal(response.headers['X-Accel-Buffering'], 'no');
    assert.match(output, /event: delta\ndata: \{"content":"正在生成"\}/);
    assert.equal(output.match(/event: done/g)?.length, 1);
    assert.equal(output.match(/event: error/g)?.length ?? 0, 0);
    assert.equal(response.ended, true);
  });

  it('maps a post-header timeout to one retryable error event', () => {
    const response = new FakeResponse();
    const stream = new WorkflowSse(response as unknown as Response);
    stream.open();
    stream.fail(new LLMTimeoutError());

    const output = response.chunks.join('');
    assert.equal(output.match(/event: error/g)?.length, 1);
    assert.match(output, /"code":"LLM_TIMEOUT"/);
    assert.match(output, /"retryable":true/);
    assert.equal(output.match(/event: done/g)?.length ?? 0, 0);
  });

  it('aborts the upstream signal when the client disconnects', () => {
    const response = new FakeResponse();
    const stream = new WorkflowSse(response as unknown as Response);
    stream.open();
    response.emit('close');
    assert.equal(stream.signal.aborted, true);
  });
});
