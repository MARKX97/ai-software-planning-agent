/**
 * Stage registry — maps each workflow stage to its processor instance.
 *
 * Built once per request via {@link createStageRegistry}. The workflow service
 * uses it to look up the processor for the current stage during execution.
 *
 * @internal
 */
import type { WorkflowStage } from '@ai-planning/shared';
import type { StageProcessor } from './stage-processor.js';
import type { StageDeps } from './stage-deps.js';
import { RequirementAnalysisStage } from './requirement-analysis.stage.js';
import { RequirementClarificationStage } from './requirement-clarification.stage.js';
import { MultiModelAnalysisStage } from './multi-model-analysis.stage.js';
import { RequirementSynthesisStage } from './requirement-synthesis.stage.js';
import { FeasibilityAnalysisStage } from './feasibility-analysis.stage.js';
import { RiskAnalysisStage } from './risk-analysis.stage.js';
import { MvpCompressionStage } from './mvp-compression.stage.js';
import { PlatformRecommendationStage } from './platform-recommendation.stage.js';
import { PlanningGenerationStage } from './planning-generation.stage.js';

/** Build a fresh registry mapping stage → processor instance. */
export function createStageRegistry(deps: StageDeps): Map<WorkflowStage, StageProcessor> {
  const processors: StageProcessor[] = [
    new RequirementAnalysisStage(deps),
    new RequirementClarificationStage(deps),
    new MultiModelAnalysisStage(deps),
    new RequirementSynthesisStage(deps),
    new FeasibilityAnalysisStage(deps),
    new RiskAnalysisStage(deps),
    new MvpCompressionStage(deps),
    new PlatformRecommendationStage(deps),
    new PlanningGenerationStage(deps),
  ];
  return new Map(processors.map((p) => [p.stage, p]));
}
