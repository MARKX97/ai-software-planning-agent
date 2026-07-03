/**
 * Execution-stage status enums — mirror the Prisma `StageStatus`,
 * `ExecutionStatus`, and `CallStatus` enums. Used by the workflow state
 * machine and stage processors to persist intermediate states.
 *
 * Source: `specs/state-machine.spec.md` §2-3.
 * @internal
 */
export const StageStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

export const ExecutionStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
} as const;

export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

export const CallStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  RATE_LIMITED: 'rate_limited',
} as const;

export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];
