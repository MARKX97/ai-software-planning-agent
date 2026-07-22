import { decisionSnapshotSchema, WorkflowStage, type DecisionSnapshot } from '@ai-planning/shared';
import type { Prisma } from '@ai-planning/database';
import type { PrismaService } from '../../database/database.module.js';
import { stageDisplayName } from './workflow-response.dto.js';
import { confirmedStateData } from './workflow-state-persister.js';

const MAX_FEEDBACK_ITEMS = 5;
const MAX_DECISION_ITEMS = 8;
const MAX_ITEM_LENGTH = 300;

interface CheckpointDecisionInput {
  readonly projectId: string;
  readonly conversationId: string;
  readonly stage: WorkflowStage;
}

export async function confirmCheckpointDecision(
  db: PrismaService,
  input: CheckpointDecisionInput,
): Promise<DecisionSnapshot> {
  return db.client.$transaction((tx) => confirmInTransaction(tx, input));
}

async function confirmInTransaction(
  tx: Prisma.TransactionClient,
  input: CheckpointDecisionInput,
): Promise<DecisionSnapshot> {
  const { projectId, conversationId, stage } = input;
  const [state, conversation] = await Promise.all([
    tx.workflowState.findUnique({
      where: { project_id_stage: { project_id: projectId, stage } },
    }),
    tx.conversation.findFirst({
      where: { id: conversationId, project_id: projectId },
      include: { messages: { orderBy: { created_at: 'asc' } } },
    }),
  ]);
  if (!state || !conversation) throw new Error('Checkpoint state or conversation not found');

  const snapshot = buildDecisionSnapshot({
    stage,
    data: state.data_json,
    messages: conversation.messages,
    confirmedAt: new Date(),
  });
  await tx.message.create({
    data: {
      conversation_id: conversationId,
      role: 'assistant',
      content: `已确认：${snapshot.summary}`,
      metadata: {
        workflow: true,
        kind: 'decision_snapshot',
        checkpoint_stage: stage,
        snapshot,
      } as never,
    },
  });
  await tx.workflowState.update({
    where: { project_id_stage: { project_id: projectId, stage } },
    data: {
      status: 'completed',
      data_json: confirmedStateData(state.data_json) as never,
      updated_at: new Date(),
    },
  });
  await tx.conversation.update({
    where: { id: conversationId },
    data: { status: 'closed', updated_at: new Date() },
  });
  return snapshot;
}

export function decisionSnapshotsFromMessages(
  messages: ReadonlyArray<{ readonly metadata: unknown }>,
): DecisionSnapshot[] {
  return messages.flatMap((message) => {
    const metadata = record(message.metadata);
    const parsed = decisionSnapshotSchema.safeParse(metadata?.['snapshot']);
    return metadata?.['kind'] === 'decision_snapshot' && parsed.success ? [parsed.data] : [];
  });
}

export async function loadDecisionSnapshots(
  db: PrismaService,
  projectId: string,
): Promise<DecisionSnapshot[]> {
  const messages = await db.client.message.findMany({
    where: {
      conversation: { project_id: projectId },
      metadata: { path: ['kind'], equals: 'decision_snapshot' },
    },
    orderBy: { created_at: 'asc' },
    select: { metadata: true },
  });
  return decisionSnapshotsFromMessages(messages);
}

function buildDecisionSnapshot(input: {
  readonly stage: WorkflowStage;
  readonly data: unknown;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
  readonly confirmedAt: Date;
}): DecisionSnapshot {
  const { stage, data, messages, confirmedAt } = input;
  const values = record(data) ?? {};
  const userFeedback = messages
    .filter((message) => message.role === 'user')
    .map((message) => compact(message.content))
    .filter(Boolean)
    .slice(-MAX_FEEDBACK_ITEMS);
  const summary = compact(stageSummary(stage, values));
  const decisions = unique(stageDecisions(stage, values, userFeedback)).slice(
    0,
    MAX_DECISION_ITEMS,
  );
  return decisionSnapshotSchema.parse({
    stage,
    summary,
    decisions: decisions.length > 0 ? decisions : ['用户确认当前阶段结论'],
    user_feedback: userFeedback,
    confirmed_at: confirmedAt.toISOString(),
  });
}

function stageSummary(stage: WorkflowStage, data: Record<string, unknown>): string {
  const fieldByStage: Partial<Record<WorkflowStage, string>> = {
    [WorkflowStage.REQUIREMENT_SYNTHESIS]: 'executive_summary',
    [WorkflowStage.MVP_COMPRESSION]: 'mvp_goal',
    [WorkflowStage.PLATFORM_RECOMMENDATION]: 'rationale',
  };
  return stringValue(data[fieldByStage[stage] ?? '']) ?? `用户已确认${stageDisplayName(stage)}结论`;
}

function stageDecisions(
  stage: WorkflowStage,
  data: Record<string, unknown>,
  userFeedback: string[],
): string[] {
  if (stage === WorkflowStage.REQUIREMENT_SYNTHESIS) {
    return [
      stringValue(data['scope_boundary']),
      ...objectStringValues(data['conflicts_resolved'], 'resolution'),
    ].filter(isString);
  }
  if (stage === WorkflowStage.MVP_COMPRESSION) {
    return [
      ...objectStringValues(data['mvp_scope'], 'title').map((item) => `首版包含：${item}`),
      ...objectStringValues(data['deferred_scope'], 'title').map((item) => `暂缓：${item}`),
    ];
  }
  if (stage === WorkflowStage.PLATFORM_RECOMMENDATION) {
    return [
      prefixed('推荐平台', data['recommended_platform']),
      prefixed('方案取舍', data['trade_offs']),
    ].filter(isString);
  }
  return userFeedback;
}

function objectStringValues(value: unknown, key: string): string[] {
  return Array.isArray(value)
    ? value.map((item) => stringValue(record(item)?.[key])).filter(isString)
    : [];
}

function prefixed(label: string, value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? `${label}：${text}` : undefined;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_LENGTH);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? compact(value) : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}
