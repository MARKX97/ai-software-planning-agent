import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationConversation } from '../src/components/workflow/clarification-conversation';
import type { MessageResponse } from '../src/types/api';

const messages: MessageResponse[] = [
  {
    id: 'assistant-1',
    conversation_id: 'conversation-1',
    role: 'assistant',
    content: '1. 首版主要服务哪个城市？',
    metadata: null,
    created_at: '2026-07-09T00:00:00.000Z',
  },
  {
    id: 'user-1',
    conversation_id: 'conversation-1',
    role: 'user',
    content: '先服务上海。',
    metadata: null,
    created_at: '2026-07-09T00:01:00.000Z',
  },
  {
    id: 'assistant-2',
    conversation_id: 'conversation-1',
    role: 'assistant',
    content: '1. 你想用哪个数字判断它有没有帮到用户？',
    metadata: null,
    created_at: '2026-07-09T00:02:00.000Z',
  },
];

describe('ClarificationConversation', () => {
  it('renders multiple rounds and submits the next reply', async () => {
    const onSubmit = vi.fn();
    const onAdvance = vi.fn();
    const onAnswerChange = vi.fn();
    render(
      <ClarificationConversation
        actionError={null}
        answer=""
        busy={false}
        canAdvance
        canReply
        currentQuestions={[]}
        historyError={null}
        isLoading={false}
        messages={messages}
        onAnswerChange={onAnswerChange}
        onAdvance={onAdvance}
        onRetryHistory={vi.fn()}
        onSubmit={onSubmit}
        pendingUserMessage={null}
        stageName="需求澄清"
        streamingReply={null}
      />,
    );

    expect(screen.getByText('先服务上海。')).toBeInTheDocument();
    expect(screen.getByText(/哪个数字判断/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('你的回复'), '看完成推荐的比例');
    expect(onAnswerChange).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '继续讨论' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onAdvance).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '确认，继续下一环节' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onAdvance).toHaveBeenCalledOnce();
  });

  it('renders the pending user message and streaming reply', () => {
    render(
      <ClarificationConversation
        actionError={null}
        answer="补充内容"
        busy
        canAdvance={false}
        canReply
        currentQuestions={[]}
        historyError={null}
        isLoading={false}
        messages={[]}
        onAnswerChange={vi.fn()}
        onAdvance={vi.fn()}
        onRetryHistory={vi.fn()}
        onSubmit={vi.fn()}
        pendingUserMessage="补充内容"
        stageName="需求澄清"
        streamingReply="我先确认一下"
      />,
    );
    expect(screen.getAllByText('补充内容')).toHaveLength(2);
    expect(screen.getByText('我先确认一下')).toHaveAttribute('aria-busy', 'true');
  });
});
