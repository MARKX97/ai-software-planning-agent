import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage } from '@ai-planning/shared';
import { createStageRegistry } from '../../src/modules/workflow/stages/stage-registry.js';
import {
  STAGE_PROVIDER,
  STAGE_TIMEOUT_MS,
} from '../../src/modules/workflow/stages/model-routing.js';

// Minimal mock deps — registry only needs the shape, not real behavior.
const mockDeps = {
  orchestrator: {} as never,
  db: { client: {} } as never,
  dataDir: '/tmp',
};

const registry = createStageRegistry(mockDeps);

describe('stage registry', () => {
  it('registers all 9 execution stages', () => {
    assert.equal(registry.size, 9);
  });

  it('registers requirement_analysis stage', () => {
    assert.ok(registry.has(WorkflowStage.REQUIREMENT_ANALYSIS));
  });

  it('registers planning_generation stage', () => {
    assert.ok(registry.has(WorkflowStage.PLANNING_GENERATION));
  });

  it('does NOT register init/completed/failed (non-execution stages)', () => {
    assert.equal(registry.has(WorkflowStage.INIT), false);
    assert.equal(registry.has(WorkflowStage.COMPLETED), false);
    assert.equal(registry.has(WorkflowStage.FAILED), false);
  });

  it('each registered processor has a stage field matching its key', () => {
    for (const [stage, processor] of registry) {
      assert.equal(
        processor.stage,
        stage,
        `processor.stage (${processor.stage}) matches key (${stage})`,
      );
    }
  });
});

describe('model routing config', () => {
  it('routes requirement_analysis to deepseek', () => {
    assert.equal(STAGE_PROVIDER.requirement_analysis, 'deepseek');
  });

  it('routes requirement_clarification to glm', () => {
    assert.equal(STAGE_PROVIDER.requirement_clarification, 'glm');
  });

  it('marks multi_model_analysis as "all"', () => {
    assert.equal(STAGE_PROVIDER.multi_model_analysis, 'all');
  });

  it('routes requirement_synthesis to deepseek', () => {
    assert.equal(STAGE_PROVIDER.requirement_synthesis, 'deepseek');
  });

  it('routes feasibility_analysis to glm', () => {
    assert.equal(STAGE_PROVIDER.feasibility_analysis, 'glm');
  });

  it('routes risk_analysis to deepseek', () => {
    assert.equal(STAGE_PROVIDER.risk_analysis, 'deepseek');
  });

  it('routes mvp_compression to deepseek', () => {
    assert.equal(STAGE_PROVIDER.mvp_compression, 'deepseek');
  });

  it('routes platform_recommendation to glm', () => {
    assert.equal(STAGE_PROVIDER.platform_recommendation, 'glm');
  });

  it('marks planning_generation as "mixed"', () => {
    assert.equal(STAGE_PROVIDER.planning_generation, 'mixed');
  });

  it('keeps extended timeouts for multi-model analysis and planning', () => {
    assert.equal(STAGE_TIMEOUT_MS.multi_model_analysis, 90_000);
    assert.equal(STAGE_TIMEOUT_MS.planning_generation, 120_000);
  });
});
