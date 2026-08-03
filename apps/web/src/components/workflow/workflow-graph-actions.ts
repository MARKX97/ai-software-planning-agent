import {
  advanceWorkflow,
  continueWorkflow,
  discussWorkflow,
  type WorkflowStreamCallbacks,
} from '@/features/workflow/api';
import type { WorkflowStatusResponse } from '@/types/api';

export function submitWorkflowMessage(input: {
  projectId: string;
  conversationId: string;
  message: string;
  graphRun: WorkflowStatusResponse['graph_run'];
  resume: boolean;
  callbacks: WorkflowStreamCallbacks;
}) {
  return input.resume
    ? continueWorkflow(input.projectId, {
        conversationId: input.conversationId,
        message: input.message,
        ...(input.graphRun
          ? {
              graphRunId: input.graphRun.id,
              checkpointVersion: input.graphRun.checkpoint_version,
            }
          : {}),
        ...input.callbacks,
      })
    : discussWorkflow(input.projectId, {
        conversationId: input.conversationId,
        message: input.message,
        ...input.callbacks,
      });
}

export function advanceGraphCheckpoint(
  projectId: string,
  conversationId: string,
  graphRun: WorkflowStatusResponse['graph_run'],
) {
  return advanceWorkflow({
    projectId,
    conversationId,
    ...(graphRun
      ? { graphRunId: graphRun.id, checkpointVersion: graphRun.checkpoint_version }
      : {}),
  });
}
