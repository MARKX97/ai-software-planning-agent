import { randomUUID } from 'node:crypto';
import type { ToolStep } from '@ai-planning/database';
import type { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';

const TOOL_CLAIM_LEASE_MS = 2 * 60 * 1_000;
const TOOL_RESULT_POLL_MS = 20;

export interface ToolClaimInput {
  readonly graphRunId: string;
  readonly executionId: string;
  readonly stage: WorkflowStage;
  readonly logicalAttempt: number;
  readonly callNumber: number;
  readonly tool: string;
  readonly argumentsJson: Record<string, unknown>;
}

export interface ToolClaim {
  readonly row: ToolStep;
  readonly token: string | null;
  readonly owned: boolean;
}

export async function claimToolStep(db: PrismaService, input: ToolClaimInput): Promise<ToolClaim> {
  const token = randomUUID();
  const now = new Date();
  const row = await db.client.toolStep.upsert({
    where: { graph_run_id_stage_logical_attempt_call_number: uniqueKey(input) },
    create: {
      graph_run_id: input.graphRunId,
      execution_id: input.executionId,
      stage: input.stage,
      node: 'choose_action',
      tool: input.tool,
      call_number: input.callNumber,
      logical_attempt: input.logicalAttempt,
      claim_token: token,
      lease_expires_at: leaseDeadline(now),
      status: 'running',
      arguments_json: input.argumentsJson as never,
      updated_at: now,
    },
    update: {},
  });
  if (row.claim_token === token) return { row, token, owned: true };
  return waitForResultOrClaim(db, row);
}

async function waitForResultOrClaim(db: PrismaService, initial: ToolStep): Promise<ToolClaim> {
  let row = initial;
  while (row.status === 'running' && !row.result_json) {
    const now = new Date();
    if (!row.lease_expires_at || row.lease_expires_at <= now) {
      const token = randomUUID();
      const claimed = await db.client.toolStep.updateMany({
        where: {
          id: row.id,
          status: 'running',
          claim_token: row.claim_token,
          lease_expires_at: row.lease_expires_at,
        },
        data: { claim_token: token, lease_expires_at: leaseDeadline(now), updated_at: now },
      });
      if (claimed.count === 1) {
        return { row: { ...row, claim_token: token }, token, owned: true };
      }
    }
    await delay(TOOL_RESULT_POLL_MS);
    row = await db.client.toolStep.findUniqueOrThrow({ where: { id: row.id } });
  }
  return { row, token: null, owned: false };
}

function uniqueKey(input: ToolClaimInput) {
  return {
    graph_run_id: input.graphRunId,
    stage: input.stage,
    logical_attempt: input.logicalAttempt,
    call_number: input.callNumber,
  };
}

function leaseDeadline(now: Date): Date {
  return new Date(now.getTime() + TOOL_CLAIM_LEASE_MS);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
