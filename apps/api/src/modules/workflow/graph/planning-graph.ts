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
  logicalAttempt: Annotation<number>(),
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
export interface PrepareGraphStageInput {
  readonly graphRunId: string;
  readonly context: WorkflowContext;
  readonly stage: WorkflowStage;
  readonly logicalAttempt: number;
}
export type PrepareGraphStage = (input: PrepareGraphStageInput) => Promise<WorkflowContext>;

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
  prepareStage: PrepareGraphStage = async ({ context }) => context,
) {
  const chooseAction = chooseActionNode(prepareStage);
  const runStage = runStageNode(executeStage);
  const builder = new StateGraph(PlanningState)
    .addNode('choose_action', chooseAction)
    .addNode('human_interrupt', humanInterruptNode)
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
  builder.addConditionalEdges('human_interrupt', routeAfterInterrupt);
  return builder.compile({ checkpointer });
}

function chooseActionNode(prepareStage: PrepareGraphStage) {
  return async (state: PlanningGraphState) => {
    const context = {
      ...state.context,
      graphRunId: state.graphRunId,
      logicalAttempt: state.logicalAttempt,
    };
    return {
      context: await prepareStage({
        graphRunId: state.graphRunId,
        context,
        stage: state.stage,
        logicalAttempt: state.logicalAttempt,
      }),
      currentNode: 'choose_action',
    };
  };
}

function runStageNode(executeStage: ExecuteGraphStage) {
  return async (state: PlanningGraphState) => {
    const result = await executeStage(state.context, state.stage);
    return {
      context: state.context,
      stage: result.nextStage,
      nextStage: result.nextStage,
      currentNode: result.stage,
      waitingFor: result.waitingFor,
    };
  };
}

function humanInterruptNode(state: PlanningGraphState) {
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
    logicalAttempt: state.logicalAttempt + 1,
  };
}

function routeAfterStage(state: PlanningGraphState): string {
  if (state.waitingFor) return 'human_interrupt';
  return state.stage === WorkflowStage.COMPLETED ? END : 'choose_action';
}

function routeAfterInterrupt(state: PlanningGraphState): string {
  return state.stage === WorkflowStage.COMPLETED ? END : 'choose_action';
}

export const PLANNING_GRAPH_STAGES = stageNames;
