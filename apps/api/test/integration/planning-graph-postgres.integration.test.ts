import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { Command } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { WorkflowStage, type WorkflowContext } from '@ai-planning/shared';
import {
  createPlanningGraph,
  PLANNING_GRAPH_STAGES,
} from '../../src/modules/workflow/graph/planning-graph.js';

const enabled = process.env['RUN_REAL_INTEGRATION'] === '1';

describe('PostgreSQL planning graph recovery', () => {
  it(
    'resumes an interrupted thread after recreating the checkpointer',
    { skip: !enabled },
    async () => {
      const databaseUrl = process.env['DATABASE_URL'];
      assert.ok(databaseUrl);
      const threadId = randomUUID();
      const calls: WorkflowStage[] = [];
      const execute = async (_context: WorkflowContext, stage: WorkflowStage) => {
        calls.push(stage);
        const index = PLANNING_GRAPH_STAGES.indexOf(
          stage as (typeof PLANNING_GRAPH_STAGES)[number],
        );
        return {
          stage,
          nextStage: PLANNING_GRAPH_STAGES[index + 1] ?? WorkflowStage.COMPLETED,
          waitingFor:
            stage === WorkflowStage.REQUIREMENT_CLARIFICATION ? ('review' as const) : null,
        };
      };
      const config = { configurable: { thread_id: threadId } };
      const firstSaver = PostgresSaver.fromConnString(databaseUrl);
      try {
        await firstSaver.setup();
        const firstGraph = createPlanningGraph(firstSaver, execute);
        await firstGraph.invoke(initialState(threadId), config);
      } finally {
        await firstSaver.end();
      }

      const secondSaver = PostgresSaver.fromConnString(databaseUrl);
      try {
        const recoveredGraph = createPlanningGraph(secondSaver, execute);
        await recoveredGraph.invoke(
          new Command({
            resume: {
              context: workflowContext('execution-2'),
              stage: WorkflowStage.MULTI_MODEL_ANALYSIS,
            },
          }),
          config,
        );
        assert.equal(
          calls.filter((stage) => stage === WorkflowStage.REQUIREMENT_ANALYSIS).length,
          1,
        );
        assert.equal(
          (await recoveredGraph.getState(config)).values['stage'],
          WorkflowStage.COMPLETED,
        );
        await secondSaver.deleteThread(threadId);
      } finally {
        await secondSaver.end();
      }
    },
  );
});

function initialState(graphRunId: string) {
  const stage = WorkflowStage.REQUIREMENT_ANALYSIS;
  return {
    graphRunId,
    context: workflowContext('execution-1'),
    stage,
    nextStage: stage,
    currentNode: 'start',
    waitingFor: null,
  };
}

function workflowContext(executionId: string): WorkflowContext {
  return {
    projectId: 'postgres-recovery-test',
    executionId,
    originalIdea: 'recover after process restart',
    conversationHistory: '',
    confirmedDecisions: [],
    clarificationRound: 0,
    resultsByStage: {},
  };
}
