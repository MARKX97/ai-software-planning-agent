import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../src/common/exception/app-exception.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { claimWorkflowExecution } from '../../src/modules/workflow/workflow-store.js';

describe('workflow start claim', () => {
  it('creates one execution for two concurrent claims of the same snapshot', async () => {
    const fixture = claimFixture();
    const project = fixture.project as never;

    const results = await Promise.allSettled([
      claimWorkflowExecution(fixture.db as never, {
        project,
        stage: WorkflowStage.REQUIREMENT_ANALYSIS,
        restartProject: true,
      }),
      claimWorkflowExecution(fixture.db as never, {
        project,
        stage: WorkflowStage.REQUIREMENT_ANALYSIS,
        restartProject: true,
      }),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = results.find((result) => result.status === 'rejected');
    assert.ok(rejected?.status === 'rejected');
    assert.ok(rejected.reason instanceof AppException);
    assert.equal(rejected.reason.code, ErrorCode.WORKFLOW_ALREADY_RUNNING);
    assert.equal(fixture.executionCount(), 1);
  });

  it('reclaims an expired Graph lease in the project/execution transaction', async () => {
    const fixture = claimFixture();

    await claimWorkflowExecution(fixture.db as never, {
      project: fixture.project as never,
      stage: WorkflowStage.RISK_ANALYSIS,
      resume: {
        graphRunId: '11111111-1111-4111-8111-111111111111',
        checkpointVersion: 3,
        stage: WorkflowStage.RISK_ANALYSIS,
        kind: 'retry',
        claimStatus: 'expired',
        logicalAttempt: 2,
      },
      restartProject: true,
    });

    assert.equal(fixture.graphClaimCount(), 1);
    assert.equal(fixture.executionCount(), 1);
  });
});

function claimFixture() {
  const project = {
    id: 'project-1',
    status: 'active',
    current_stage: WorkflowStage.INIT,
  };
  let executions = 0;
  let graphClaims = 0;
  const tx = {
    graphRun: {
      updateMany: async (input: { where: Record<string, unknown> }) => {
        assert.equal(input.where['status'], 'running');
        assert.ok(input.where['lease_expires_at']);
        graphClaims += 1;
        return { count: 1 };
      },
    },
    project: {
      updateMany: async (input: { where: { status: string; current_stage: string } }) => {
        if (
          project.status !== input.where.status ||
          project.current_stage !== input.where.current_stage
        ) {
          return { count: 0 };
        }
        project.current_stage = WorkflowStage.REQUIREMENT_ANALYSIS;
        return { count: 1 };
      },
    },
    workflowExecution: {
      create: async () => ({ id: `execution-${++executions}` }),
    },
  };
  return {
    project: { ...project },
    db: { client: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) } },
    executionCount: () => executions,
    graphClaimCount: () => graphClaims,
  };
}
