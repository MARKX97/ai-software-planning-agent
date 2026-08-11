import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppException } from '../../src/common/exception/app-exception.js';
import {
  MAX_RATE_LIMIT_BUCKETS,
  WorkflowRateLimitGuard,
} from '../../src/common/guards/workflow-rate-limit.guard.js';

describe('WorkflowRateLimitGuard capacity', () => {
  it('fails closed instead of growing beyond the bucket cap', () => {
    const guard = new WorkflowRateLimitGuard({
      apiKey: '',
      workflowRateLimitPerMinute: 100_000,
    } as never);
    for (let index = 0; index < MAX_RATE_LIMIT_BUCKETS / 2; index += 1) {
      assert.equal(
        guard.canActivate(context(`project-${index}`, `10.0.${index >> 8}.${index & 255}`)),
        true,
      );
    }

    assert.throws(
      () => guard.canActivate(context('overflow', '192.0.2.1')),
      (error: unknown) => error instanceof AppException,
    );
  });

  it('normalizes IPv4-mapped addresses to one caller', () => {
    const guard = new WorkflowRateLimitGuard({
      apiKey: '',
      workflowRateLimitPerMinute: 1,
    } as never);
    assert.equal(guard.canActivate(context('project-a', '::ffff:127.0.0.1')), true);
    assert.throws(() => guard.canActivate(context('project-b', '127.0.0.1')), AppException);
  });
});

function context(projectId: string, ip: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, params: { project_id: projectId }, ip }),
    }),
  } as never;
}
