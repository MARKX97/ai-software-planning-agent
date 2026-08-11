import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prisma } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import { claimWorkflowExecution } from '../../src/modules/workflow/workflow-store.js';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';

describe('PostgreSQL workflow start claim', () => {
  it('admits exactly one concurrent start', { skip: !enabled }, async () => {
    const project = await prisma.project.create({
      data: {
        name: 'workflow-claim-test',
        original_idea: 'claim once',
        status: 'active',
        current_stage: WorkflowStage.INIT,
        updated_at: new Date(),
      },
    });
    try {
      const results = await Promise.allSettled([
        claimWorkflowExecution({ client: prisma } as never, {
          project,
          stage: WorkflowStage.REQUIREMENT_ANALYSIS,
          restartProject: true,
        }),
        claimWorkflowExecution({ client: prisma } as never, {
          project,
          stage: WorkflowStage.REQUIREMENT_ANALYSIS,
          restartProject: true,
        }),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(await prisma.workflowExecution.count({ where: { project_id: project.id } }), 1);
    } finally {
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it(
    'rolls back a resume claim when the project transition fails',
    { skip: !enabled },
    async () => {
      const project = await prisma.project.create({
        data: {
          name: 'workflow-resume-claim-test',
          original_idea: 'recover a checkpoint',
          status: 'active',
          current_stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
          updated_at: new Date(),
        },
      });
      const run = await prisma.graphRun.create({
        data: {
          project_id: project.id,
          status: 'interrupted',
          current_node: 'human_interrupt',
          current_stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
          checkpoint_version: 2,
          updated_at: new Date(),
        },
      });
      const resume = {
        graphRunId: run.id,
        checkpointVersion: 2,
        stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
        kind: 'interrupt' as const,
        claimStatus: 'interrupted' as const,
        logicalAttempt: 1,
      };
      try {
        await assert.rejects(() =>
          claimWorkflowExecution({ client: prisma } as never, {
            project: { ...project, current_stage: WorkflowStage.REQUIREMENT_SYNTHESIS },
            stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
            resume,
          }),
        );
        assert.equal(
          (await prisma.graphRun.findUniqueOrThrow({ where: { id: run.id } })).status,
          'interrupted',
        );
        assert.equal(
          await prisma.workflowExecution.count({ where: { project_id: project.id } }),
          0,
        );

        await claimWorkflowExecution({ client: prisma } as never, {
          project,
          stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
          resume,
        });
        const claimed = await prisma.graphRun.findUniqueOrThrow({ where: { id: run.id } });
        assert.equal(claimed.status, 'running');
        assert.ok(claimed.lease_expires_at);
      } finally {
        await prisma.project.delete({ where: { id: project.id } });
      }
    },
  );
});
