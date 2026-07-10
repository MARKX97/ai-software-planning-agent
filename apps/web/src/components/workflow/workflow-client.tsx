'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
import { getUserErrorMessage } from '@/lib/api-client';

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
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const statusQuery = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => getWorkflowStatus(projectId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data?.status === 'active' &&
        data.current_stage !== 'requirement_clarification' &&
        data.current_stage !== 'completed' &&
        data.current_stage !== 'failed'
      ) {
        return 3000;
      }
      return false;
    },
  });
  const statesQuery = useQuery({
    queryKey: ['workflow-states', projectId],
    queryFn: () => listWorkflowStates(projectId),
    refetchInterval: () => {
      const data = statusQuery.data;
      if (
        data?.status === 'active' &&
        data.current_stage !== 'requirement_clarification' &&
        data.current_stage !== 'completed' &&
        data.current_stage !== 'failed'
      ) {
        return 3000;
      }
      return false;
    },
  });
  const startMutation = useMutation({
    mutationFn: () => runWorkflow(projectId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow-status', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-states', projectId] }),
      ]);
    },
  });
  const continueMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversation = await createConversation(projectId);
      return continueWorkflow(projectId, conversation.id, message);
    },
    onSuccess: async () => {
      setAnswer('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow-status', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-states', projectId] }),
      ]);
    },
  });
  const status = statusQuery.data;
  const questions = useMemo(() => status?.clarification_questions ?? [], [status]);
  const failureMessage = status?.error_message
    ? getUserErrorMessage(status.error_message, '工作流执行失败，请稍后重试。')
    : null;

  async function startWorkflow() {
    setBusy(true);
    setActionError(null);
    try {
      await startMutation.mutateAsync();
    } catch (error) {
      setActionError(getUserErrorMessage(error, '工作流启动失败，请稍后重试。'));
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
      await continueMutation.mutateAsync(answer.trim());
    } catch (error) {
      setActionError(getUserErrorMessage(error, '回复提交失败，请稍后重试。'));
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
      {statusQuery.isLoading || statesQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {statusQuery.error ? (
        <ErrorState error={statusQuery.error} onRetry={() => void statusQuery.refetch()} />
      ) : null}
      {statesQuery.error ? (
        <ErrorState
          error={statesQuery.error}
          onRetry={() => void statesQuery.refetch()}
          title="阶段记录加载失败"
        />
      ) : null}
      {status ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <StageRail status={status} states={statesQuery.data?.items ?? []} />
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

            {failureMessage ? (
              <Card className="border-red-200 bg-red-50">
                <CardBody className="grid gap-3">
                  <h2 className="text-sm font-bold text-red-800">工作流失败</h2>
                  <p className="text-sm leading-6 text-red-700" role="alert">
                    {actionError ?? failureMessage}
                  </p>
                  <Button
                    className="w-fit"
                    disabled={busy}
                    onClick={() => void startWorkflow()}
                    variant="danger"
                  >
                    {busy ? '重新启动中' : '重新运行工作流'}
                  </Button>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
