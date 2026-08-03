import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WorkflowStage } from '@ai-planning/shared';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { AgentGraphService } from '../../src/modules/workflow/graph/agent-graph.service.js';

describe('AgentGraphService resume guard', () => {
  it('claims a checkpoint once and rejects a duplicate resume before graph execution', async () => {
    let available = true;
    const db = {
      client: {
        graphRun: {
          updateMany: async () => {
            if (!available) return { count: 0 };
            available = false;
            return { count: 1 };
          },
        },
      },
    };
    const service = new AgentGraphService({ workflowRunner: 'graph' } as never, db as never);
    const resume = service.resumeInput({
      graphRunId: '11111111-1111-4111-8111-111111111111',
      checkpointVersion: 3,
      stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
    });
    assert.ok(resume);
    await service.reserveResume('project-1', resume);
    await assert.rejects(
      () => service.reserveResume('project-1', resume),
      (error: unknown) => (error as { code?: string }).code === ErrorCode.INVALID_STAGE_TRANSITION,
    );
  });

  it('keeps the V2 rollback path independent from graph metadata', () => {
    const service = new AgentGraphService({ workflowRunner: 'v2' } as never, {} as never);
    assert.equal(service.resumeInput({ stage: WorkflowStage.REQUIREMENT_ANALYSIS }), undefined);
  });
});
