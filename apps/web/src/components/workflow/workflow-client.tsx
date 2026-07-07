'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageFrame } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/form';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StageRail } from '@/components/workflow/stage-rail';
import {
  continueWorkflow,
  createConversation,
  getWorkflowStatus,
  listWorkflowStates,
  runWorkflow,
} from '@/features/workflow/api';
import { useAsync } from '@/lib/use-async';

function questionText(question: unknown, index: number): string {
  if (typeof question === 'string') {
    return question;
  }
  if (question && typeof question === 'object') {
    const record = question as Record<string, unknown>;
    const text = record['question'] ?? record['content'] ?? record['text'];
    if (typeof text === 'string') {
      return text;
    }
  }
  return `澄清问题 ${index + 1}`;
}

export function WorkflowClient({ projectId }: { projectId: string }) {
  const loadStatus = useCallback(() => getWorkflowStatus(projectId), [projectId]);
  const statusState = useAsync(loadStatus, [loadStatus]);
  const statesState = useAsync(() => listWorkflowStates(projectId), [projectId]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const status = statusState.data;
  const questions = useMemo(() => status?.clarification_questions ?? [], [status]);
  const shouldPoll =
    status?.status === 'active' &&
    status.current_stage !== 'requirement_clarification' &&
    status.current_stage !== 'completed' &&
    status.current_stage !== 'failed';

  useEffect(() => {
    if (!shouldPoll) {
      return undefined;
    }
    const id = window.setInterval(() => {
      void statusState.reload();
      void statesState.reload();
    }, 3000);
    return () => window.clearInterval(id);
  }, [shouldPoll, statusState, statesState]);

  async function startWorkflow() {
    setBusy(true);
    setActionError(null);
    try {
      await runWorkflow(projectId);
      await Promise.all([statusState.reload(), statesState.reload()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '启动失败');
    } finally {
      setBusy(false);
    }
  }

  async function submitClarification() {
    if (answer.trim().length === 0) {
      setActionError('请输入澄清回复。');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const conversation = await createConversation(projectId);
      await continueWorkflow(projectId, conversation.id, answer.trim());
      setAnswer('');
      await Promise.all([statusState.reload(), statesState.reload()]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}`} variant="secondary">
            项目概览
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            产物
          </ButtonLink>
        </>
      }
      description="这里展示工作流阶段、模型降级状态和澄清问题。非澄清阶段会自动轮询进度。"
      eyebrow="Workflow"
      title="规划流水线"
    >
      {statusState.loading || statesState.loading ? <ListSkeleton rows={3} /> : null}
      {statusState.error ? <ErrorState error={statusState.error} onRetry={statusState.reload} /> : null}
      {status ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <StageRail status={status} states={statesState.data?.items ?? []} />
          <aside className="grid h-fit gap-4">
            <Card className="border-slate-950 bg-slate-950 text-white">
              <CardBody>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">
                  Live Status
                </p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <h2 className="text-3xl font-black">{status.progress.percentage}%</h2>
                  <span className="text-sm text-slate-300">{status.stage_display_name}</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/15">
                  <div
                    className="h-2 rounded-full bg-cyan-300 transition-all"
                    style={{ width: `${status.progress.percentage}%` }}
                  />
                </div>
              </CardBody>
            </Card>

            {status.model_status &&
            Object.values(status.model_status).some((value) => value === 'failed') ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardBody>
                  <h2 className="text-sm font-bold text-amber-950">模型降级提醒</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    有模型调用失败，流程会尽量使用可用结果继续。请在 Usage 页面查看明细。
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {status.current_stage === 'init' ? (
              <Card>
                <CardBody className="grid gap-3">
                  <h2 className="text-base font-bold text-slate-950">尚未启动</h2>
                  <p className="text-sm leading-6 text-slate-600">
                    启动后，Agent 会按九阶段推进，并在需要人工输入时停在澄清阶段。
                  </p>
                  <Button disabled={busy} onClick={() => void startWorkflow()}>
                    {busy ? '启动中' : '启动工作流'}
                  </Button>
                </CardBody>
              </Card>
            ) : null}

            {status.current_stage === 'requirement_clarification' ? (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-bold text-slate-950">需要你补充信息</h2>
                </CardHeader>
                <CardBody className="grid gap-3">
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    {questions.map((question, index) => (
                      <li key={index}>{questionText(question, index)}</li>
                    ))}
                  </ol>
                  <Textarea
                    aria-label="澄清回复"
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="逐条回复上面的问题。可以先说明不确定项，Agent 会继续收敛。"
                    value={answer}
                  />
                  {actionError ? (
                    <p className="text-sm font-medium text-red-700" role="alert">
                      {actionError}
                    </p>
                  ) : null}
                  <Button disabled={busy} onClick={() => void submitClarification()}>
                    {busy ? '提交中' : '提交回复并继续'}
                  </Button>
                </CardBody>
              </Card>
            ) : null}

            {status.error_message ? (
              <Card className="border-red-200 bg-red-50">
                <CardBody>
                  <h2 className="text-sm font-bold text-red-800">工作流失败</h2>
                  <p className="mt-2 text-sm leading-6 text-red-700" role="alert">
                    {status.error_message}
                  </p>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
