import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Command, MemorySaver } from '@langchain/langgraph';
import { WorkflowStage, type WorkflowContext } from '@ai-planning/shared';
import {
  createPlanningGraph,
  PLANNING_GRAPH_STAGES,
} from '../../src/modules/workflow/graph/planning-graph.js';

describe('P1 planning graph', () => {
  it('checkpoints an interrupt and resumes the same thread without replaying completed stages', async () => {
    const calls: WorkflowStage[] = [];
    const graph = createPlanningGraph(new MemorySaver(), async (_context, stage) => {
      calls.push(stage);
      const index = PLANNING_GRAPH_STAGES.indexOf(stage as (typeof PLANNING_GRAPH_STAGES)[number]);
      const nextStage = PLANNING_GRAPH_STAGES[index + 1] ?? WorkflowStage.COMPLETED;
      return {
        stage,
        nextStage,
        waitingFor: stage === WorkflowStage.REQUIREMENT_CLARIFICATION ? 'review' : null,
      };
    });
    const config = { configurable: { thread_id: 'graph-run-1' } };
    const context = workflowContext();
    await graph.invoke(
      {
        graphRunId: 'graph-run-1',
        context,
        stage: WorkflowStage.REQUIREMENT_ANALYSIS,
        nextStage: WorkflowStage.REQUIREMENT_ANALYSIS,
        currentNode: 'start',
        waitingFor: null,
      },
      config,
    );
    assert.deepEqual(calls, [
      WorkflowStage.REQUIREMENT_ANALYSIS,
      WorkflowStage.REQUIREMENT_CLARIFICATION,
    ]);

    await graph.invoke(
      new Command({
        resume: { executionId: 'execution-2', stage: WorkflowStage.MULTI_MODEL_ANALYSIS },
      }),
      config,
    );
    assert.equal(calls.filter((stage) => stage === WorkflowStage.REQUIREMENT_ANALYSIS).length, 1);
    assert.equal(calls.at(-1), WorkflowStage.PLANNING_GENERATION);
    assert.equal((await graph.getState(config)).values['stage'], WorkflowStage.COMPLETED);
  });
});

function workflowContext(): WorkflowContext {
  return {
    projectId: 'project-1',
    executionId: 'execution-1',
    originalIdea: 'idea',
    conversationHistory: '',
    confirmedDecisions: [],
    clarificationRound: 0,
    resultsByStage: {},
  };
}
