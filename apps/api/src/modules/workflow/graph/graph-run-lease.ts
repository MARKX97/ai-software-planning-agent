export const GRAPH_RUN_LEASE_MS = 10 * 60 * 1_000;

export type GraphClaimStatus = 'interrupted' | 'failed' | 'expired';

export function graphLeaseDeadline(now = new Date()): Date {
  return new Date(now.getTime() + GRAPH_RUN_LEASE_MS);
}
