import {
  Annotation,
  END,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from '@langchain/langgraph';
import { WorkflowStage, type WorkflowContext } from '@ai-planning/shared';
import type { PipelineStageResult } from '../workflow-pipeline-runner.js';

export interface GraphResume {
  readonly context: WorkflowContext;
  readonly stage: WorkflowStage;
}

const PlanningState = Annotation.Root({
  graphRunId: Annotation<string>(),
  context: Annotation<WorkflowContext>(),
  stage: Annotation<WorkflowStage>(),
  nextStage: Annotation<WorkflowStage>(),
  currentNode: Annotation<string>(),
  waitingFor: Annotation<'reply' | 'review' | null>(),
});

export type PlanningGraphState = typeof PlanningState.State;
export type ExecuteGraphStage = (
  context: WorkflowContext,
  stage: WorkflowStage,
) => Promise<PipelineStageResult>;
export type PrepareGraphStage = (
  graphRunId: string,
  context: WorkflowContext,
  stage: WorkflowStage,
) => Promise<WorkflowContext>;

const stageNames = [
  WorkflowStage.REQUIREMENT_ANALYSIS,
  WorkflowStage.REQUIREMENT_CLARIFICATION,
  WorkflowStage.MULTI_MODEL_ANALYSIS,
  WorkflowStage.REQUIREMENT_SYNTHESIS,
  WorkflowStage.FEASIBILITY_ANALYSIS,
  WorkflowStage.RISK_ANALYSIS,
  WorkflowStage.MVP_COMPRESSION,
  WorkflowStage.PLATFORM_RECOMMENDATION,
  WorkflowStage.PLANNING_GENERATION,
] as const;

export function createPlanningGraph(
  checkpointer: BaseCheckpointSaver,
  executeStage: ExecuteGraphStage,
  prepareStage: PrepareGraphStage = async (_graphRunId, context) => context,
) {
  const chooseAction = async (state: PlanningGraphState) => ({
    context: await prepareStage(state.graphRunId, state.context, state.stage),
    currentNode: 'choose_action',
  });
  const runStage = async (state: PlanningGraphState) => {
    const result = await executeStage(state.context, state.stage);
    return {
      context: state.context,
      stage: result.nextStage,
      nextStage: result.nextStage,
      currentNode: result.stage,
      waitingFor: result.waitingFor,
    };
  };
  const humanInterrupt = (state: PlanningGraphState) => {
    const resume = interrupt({
      graphRunId: state.graphRunId,
      stage: state.currentNode,
      waitingFor: state.waitingFor,
    }) as GraphResume;
    return {
      context: resume.context,
      stage: resume.stage,
      nextStage: resume.stage,
      currentNode: 'human_interrupt',
      waitingFor: null,
    };
  };
  const routeAfterStage = (state: PlanningGraphState): string => {
    if (state.waitingFor) return 'human_interrupt';
    return state.stage === WorkflowStage.COMPLETED ? END : 'choose_action';
  };
  const builder = new StateGraph(PlanningState)
    .addNode('choose_action', chooseAction)
    .addNode('human_interrupt', humanInterrupt)
    .addNode(WorkflowStage.REQUIREMENT_ANALYSIS, runStage)
    .addNode(WorkflowStage.REQUIREMENT_CLARIFICATION, runStage)
    .addNode(WorkflowStage.MULTI_MODEL_ANALYSIS, runStage)
    .addNode(WorkflowStage.REQUIREMENT_SYNTHESIS, runStage)
    .addNode(WorkflowStage.FEASIBILITY_ANALYSIS, runStage)
    .addNode(WorkflowStage.RISK_ANALYSIS, runStage)
    .addNode(WorkflowStage.MVP_COMPRESSION, runStage)
    .addNode(WorkflowStage.PLATFORM_RECOMMENDATION, runStage)
    .addNode(WorkflowStage.PLANNING_GENERATION, runStage);
  builder.addEdge(START, 'choose_action');
  builder.addConditionalEdges('choose_action', (state) => state.stage);
  for (const stage of stageNames) {
    builder.addConditionalEdges(stage, routeAfterStage);
  }
  builder.addConditionalEdges('human_interrupt', (state) =>
    state.stage === WorkflowStage.COMPLETED ? END : 'choose_action',
  );
  return builder.compile({ checkpointer });
}

export const PLANNING_GRAPH_STAGES = stageNames;
