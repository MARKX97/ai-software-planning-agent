import { z } from 'zod';
import { WorkflowStage } from '../enums/workflow-stage.js';

const workflowStageSchema = z.enum([
  WorkflowStage.INIT,
  WorkflowStage.REQUIREMENT_ANALYSIS,
  WorkflowStage.REQUIREMENT_CLARIFICATION,
  WorkflowStage.MULTI_MODEL_ANALYSIS,
  WorkflowStage.REQUIREMENT_SYNTHESIS,
  WorkflowStage.FEASIBILITY_ANALYSIS,
  WorkflowStage.RISK_ANALYSIS,
  WorkflowStage.MVP_COMPRESSION,
  WorkflowStage.PLATFORM_RECOMMENDATION,
  WorkflowStage.PLANNING_GENERATION,
  WorkflowStage.COMPLETED,
  WorkflowStage.FAILED,
]);

export const decisionSnapshotSchema = z.object({
  stage: workflowStageSchema,
  summary: z.string().min(1),
  decisions: z.array(z.string().min(1)),
  user_feedback: z.array(z.string().min(1)),
  confirmed_at: z.string().datetime(),
});

export const artifactQualityCheckSchema = z.object({
  id: z.enum([
    'artifact_coverage',
    'markdown_structure',
    'substantive_content',
    'unresolved_placeholders',
  ]),
  label: z.string().min(1),
  status: z.enum(['passed', 'warning']),
  affected_artifacts: z.array(z.string().min(1)),
  message: z.string().min(1),
});

export const artifactQualityReportSchema = z.object({
  status: z.enum(['passed', 'warning']),
  expected_artifacts: z.literal(11),
  generated_artifacts: z.number().int().min(0).max(11),
  checks: z.array(artifactQualityCheckSchema),
  revised_artifacts: z.array(z.string().min(1)),
});

export type DecisionSnapshot = z.infer<typeof decisionSnapshotSchema>;
export type ArtifactQualityCheck = z.infer<typeof artifactQualityCheckSchema>;
export type ArtifactQualityReport = z.infer<typeof artifactQualityReportSchema>;
