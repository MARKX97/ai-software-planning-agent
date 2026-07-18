import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppException } from '../../src/common/exception/app-exception.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { syncProjectBudget } from '../../src/modules/workflow/workflow-budget.js';

function deps(totalCost: number, limit = 5) {
  let synced = -1;
  return {
    value: {
      db: {
        client: {
          tokenUsage: {
            findUnique: async () => ({ total_cost: totalCost }),
          },
        },
      },
      orchestrator: {
        syncProjectCost: (_projectId: string, cost: number) => {
          synced = cost;
          return cost >= limit;
        },
      },
    } as never,
    synced: () => synced,
  };
}

describe('workflow persisted budget admission', () => {
  it('hydrates cost below the limit', async () => {
    const input = deps(4.5);
    await syncProjectBudget(input.value, 'project-1');
    assert.equal(input.synced(), 4.5);
  });

  it('rejects new work at the configured limit', async () => {
    const input = deps(5);
    await assert.rejects(
      () => syncProjectBudget(input.value, 'project-1'),
      (error: unknown) =>
        error instanceof AppException &&
        error.code === ErrorCode.COST_LIMIT_EXCEEDED &&
        error.getStatus() === 503,
    );
    assert.equal(input.synced(), 5);
  });
});
