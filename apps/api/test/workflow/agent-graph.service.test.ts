import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WorkflowStage } from '@ai-planning/shared';
import { AgentGraphService } from '../../src/modules/workflow/graph/agent-graph.service.js';

describe('AgentGraphService resume guard', () => {
  it('describes an interrupted checkpoint claim without mutating it', () => {
    const service = new AgentGraphService(
      { workflowRunner: 'graph' } as never,
      {} as never,
      {} as never,
    );
    const resume = service.resumeInput({
      graphRunId: '11111111-1111-4111-8111-111111111111',
      checkpointVersion: 3,
      stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
    });
    assert.ok(resume);
    assert.equal(resume.claimStatus, 'interrupted');
  });

  it('keeps the V2 rollback path independent from graph metadata', () => {
    const service = new AgentGraphService(
      { workflowRunner: 'v2' } as never,
      {} as never,
      {} as never,
    );
    assert.equal(service.resumeInput({ stage: WorkflowStage.REQUIREMENT_ANALYSIS }), undefined);
  });

  it('returns the latest failed Graph checkpoint as a retry input', async () => {
    const service = new AgentGraphService(
      { workflowRunner: 'graph' } as never,
      {
        client: {
          graphRun: {
            findFirst: async () => ({
              id: '11111111-1111-4111-8111-111111111111',
              checkpoint_version: 4,
              current_stage: WorkflowStage.RISK_ANALYSIS,
              logical_attempt: 2,
            }),
          },
        },
      } as never,
      {} as never,
    );
    assert.deepEqual(await service.retryInput('project-1', 'failed'), {
      graphRunId: '11111111-1111-4111-8111-111111111111',
      checkpointVersion: 4,
      stage: WorkflowStage.RISK_ANALYSIS,
      kind: 'retry',
      claimStatus: 'failed',
      logicalAttempt: 2,
    });
  });

  it('returns an expired running checkpoint for process-crash recovery', async () => {
    let where: Record<string, unknown> | undefined;
    const service = new AgentGraphService(
      { workflowRunner: 'graph' } as never,
      {
        client: {
          graphRun: {
            findFirst: async (input: { where: Record<string, unknown> }) => {
              where = input.where;
              return {
                id: '11111111-1111-4111-8111-111111111111',
                checkpoint_version: 2,
                current_stage: WorkflowStage.FEASIBILITY_ANALYSIS,
                logical_attempt: 1,
              };
            },
          },
        },
      } as never,
      {} as never,
    );

    const retry = await service.retryInput('project-1', 'active');

    assert.equal(retry?.claimStatus, 'expired');
    assert.equal(where?.['status'], 'running');
    assert.ok(where?.['lease_expires_at']);
  });
});
