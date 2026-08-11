import type { ArtifactType } from '@ai-planning/database';
import type { ArtifactCitation } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { PLANNING_GENERATION_PROMPT } from '../../../prompts/planning-generation.prompt.js';
import { formatEvidence } from './artifact-citations.js';
import type { ArtifactQualityIssueId } from './artifact-quality.js';

export class ArtifactQualityError extends Error {
  constructor(
    type: ArtifactType,
    readonly issues: readonly ArtifactQualityIssueId[],
  ) {
    super(`Artifact '${type}' failed quality checks: ${issues.join(', ')}`);
  }
}

export function revisionPrompt(prompt: string, issues: readonly ArtifactQualityIssueId[]): string {
  return `${prompt}\n\nREVISION_REQUIRED\nFix only these quality issues and return the complete revised artifact: ${issues.join(', ')}.`;
}

export function artifactPrompt(
  context: string,
  type: ArtifactType,
  evidence: readonly ArtifactCitation[],
): string {
  return renderPrompt(PLANNING_GENERATION_PROMPT, {
    context,
    artifactType: type,
    evidence: formatEvidence(evidence),
  });
}
