import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/form';
import { getUserErrorMessage } from '@/lib/api-client';
import type { MessageResponse } from '@/types/api';

export function ClarificationConversation({
  messages,
  currentQuestions,
  canReply,
  isLoading,
  historyError,
  answer,
  actionError,
  busy,
  onAnswerChange,
  onRetryHistory,
  onSubmit,
  canAdvance,
  onAdvance,
  stageName,
  pendingUserMessage,
  streamingReply,
}: {
  messages: MessageResponse[];
  currentQuestions: unknown[];
  canReply: boolean;
  isLoading: boolean;
  historyError: Error | null;
  answer: string;
  actionError: string | null;
  busy: boolean;
  onAnswerChange: (value: string) => void;
  onRetryHistory: () => void;
  onSubmit: () => void;
  canAdvance: boolean;
  onAdvance: () => void;
  stageName: string;
  pendingUserMessage: string | null;
  streamingReply: string | null;
}) {
  const fallback = messages.length === 0 ? questionsText(currentQuestions) : null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">
          {streamingReply !== null
            ? '规划助手正在回复'
            : canReply
              ? '把不清楚的地方聊明白'
              : '我们聊过这些'}
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {canReply
            ? canAdvance
              ? `正在确认${stageName}，聊够了再决定要不要往下走。`
              : '可以来回补充，信息够了以后才会继续。'
            : '这些内容已经参与了后续规划。'}
        </p>
      </header>
      <div className="grid gap-4 px-5 py-4">
        <div aria-live="polite" className="grid max-h-[420px] gap-3 overflow-y-auto">
          {isLoading ? <p className="text-sm text-slate-500">正在找回之前的讨论...</p> : null}
          {historyError ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
              <span>{getUserErrorMessage(historyError)}</span>
              <Button onClick={onRetryHistory} variant="danger">
                再试一次
              </Button>
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {pendingUserMessage ? <ConversationBubble content={pendingUserMessage} user /> : null}
          {streamingReply !== null ? (
            <ConversationBubble content={streamingReply || '正在把这件事想清楚...'} streaming />
          ) : null}
          {!isLoading && !historyError && fallback ? (
            <div className="mr-8 rounded-md bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-700">
              {fallback}
            </div>
          ) : null}
          {!isLoading &&
          !historyError &&
          !fallback &&
          messages.length === 0 &&
          streamingReply === null ? (
            <p className="text-sm text-slate-500">这次没有留下对话记录。</p>
          ) : null}
        </div>
        {canReply ? (
          <div className="grid gap-2 border-t border-slate-100 pt-4">
            <Label htmlFor="clarification-reply">你的回复</Label>
            <Textarea
              id="clarification-reply"
              maxLength={50000}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="不必一次答得很完整。先说你确定的，也可以直接写下还没想好的地方。"
              value={answer}
            />
            {actionError ? (
              <p className="text-sm font-medium text-red-700" role="alert">
                {actionError}
              </p>
            ) : null}
            <Button disabled={busy} onClick={onSubmit}>
              {busy
                ? '正在想下一步'
                : actionError
                  ? '重新生成'
                  : canAdvance
                    ? '继续讨论'
                    : '发出回复'}
            </Button>
            {canAdvance ? (
              <Button disabled={busy} onClick={onAdvance} variant="secondary">
                确认，继续下一环节
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: MessageResponse }) {
  return <ConversationBubble content={message.content} user={message.role === 'user'} />;
}

function ConversationBubble({
  content,
  user = false,
  streaming = false,
}: {
  content: string;
  user?: boolean;
  streaming?: boolean;
}) {
  return (
    <article
      aria-busy={streaming}
      className={`max-w-[90%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm leading-6 ${
        user ? 'ml-auto bg-slate-950 text-white' : 'mr-auto bg-slate-100 text-slate-700'
      }`}
    >
      <p className={`mb-1 text-xs font-bold ${user ? 'text-slate-300' : 'text-slate-500'}`}>
        {user ? '你' : '规划助手'}
      </p>
      {content}
    </article>
  );
}

function questionsText(questions: unknown[]): string | null {
  if (questions.length === 0) return null;
  return questions.map((question, index) => `${index + 1}. ${questionText(question)}`).join('\n');
}

function questionText(question: unknown): string {
  if (typeof question === 'string') return question;
  if (question && typeof question === 'object') {
    const record = question as Record<string, unknown>;
    const text = record['question'] ?? record['content'] ?? record['text'];
    if (typeof text === 'string') return text;
  }
  return '请补充更多信息';
}
