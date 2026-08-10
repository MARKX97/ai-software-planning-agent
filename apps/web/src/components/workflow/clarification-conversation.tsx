import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/form';
import { getUserErrorMessage } from '@/lib/api-client';
import type { MessageResponse } from '@/types/api';

interface ClarificationConversationProps {
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
}

export function ClarificationConversation(props: ClarificationConversationProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <ConversationHeader {...props} />
      <div className="grid gap-4 px-5 py-4">
        <ConversationHistory {...props} />
        {props.canReply ? <ReplyComposer {...props} /> : null}
      </div>
    </section>
  );
}

function ConversationHeader(props: ClarificationConversationProps) {
  const title =
    props.streamingReply !== null
      ? '规划助手正在回复'
      : props.canReply
        ? '把不清楚的地方聊明白'
        : '我们聊过这些';
  const description = props.canReply
    ? props.canAdvance
      ? `正在确认${props.stageName}，聊够了再决定要不要往下走。`
      : '可以来回补充，信息够了以后才会继续。'
    : '这些内容已经参与了后续规划。';
  return (
    <header className="border-b border-slate-100 px-5 py-4">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </header>
  );
}

function ConversationHistory(props: ClarificationConversationProps) {
  const fallback = props.messages.length === 0 ? questionsText(props.currentQuestions) : null;
  const empty =
    !props.isLoading &&
    !props.historyError &&
    !fallback &&
    props.messages.length === 0 &&
    props.streamingReply === null;
  return (
    <div aria-live="polite" className="grid max-h-[420px] gap-3 overflow-y-auto">
      {props.isLoading ? <p className="text-sm text-slate-500">正在找回之前的讨论...</p> : null}
      {props.historyError ? (
        <HistoryError error={props.historyError} onRetry={props.onRetryHistory} />
      ) : null}
      {props.messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {props.pendingUserMessage ? (
        <ConversationBubble content={props.pendingUserMessage} user />
      ) : null}
      {props.streamingReply !== null ? (
        <ConversationBubble content={props.streamingReply || '正在把这件事想清楚...'} streaming />
      ) : null}
      {!props.isLoading && !props.historyError && fallback ? (
        <div className="mr-8 rounded-md bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-700">
          {fallback}
        </div>
      ) : null}
      {empty ? <p className="text-sm text-slate-500">这次没有留下对话记录。</p> : null}
    </div>
  );
}

function HistoryError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
      <span>{getUserErrorMessage(error)}</span>
      <Button onClick={onRetry} variant="danger">
        再试一次
      </Button>
    </div>
  );
}

function ReplyComposer(props: ClarificationConversationProps) {
  const submitLabel = props.busy
    ? '正在想下一步'
    : props.actionError
      ? '重新生成'
      : props.canAdvance
        ? '继续讨论'
        : '发出回复';
  return (
    <div className="grid gap-2 border-t border-slate-100 pt-4">
      <Label htmlFor="clarification-reply">你的回复</Label>
      <Textarea
        id="clarification-reply"
        maxLength={50000}
        onChange={(event) => props.onAnswerChange(event.target.value)}
        placeholder="不必一次答得很完整。先说你确定的，也可以直接写下还没想好的地方。"
        value={props.answer}
      />
      {props.actionError ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {props.actionError}
        </p>
      ) : null}
      <Button disabled={props.busy} onClick={props.onSubmit}>
        {submitLabel}
      </Button>
      {props.canAdvance ? (
        <Button disabled={props.busy} onClick={props.onAdvance} variant="secondary">
          确认，继续下一环节
        </Button>
      ) : null}
    </div>
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
