import type { ArtifactType } from '@ai-planning/database';
import type { ArtifactCitation, EvidenceCitation } from '@ai-planning/shared';

const EVIDENCE_ARTIFACTS = new Set<ArtifactType>(['prd', 'architecture']);

export function numberedEvidence(
  type: ArtifactType,
  evidence: readonly EvidenceCitation[],
): ArtifactCitation[] {
  if (!EVIDENCE_ARTIFACTS.has(type)) return [];
  return evidence.slice(0, 8).map((item, index) => ({ ...item, citationKey: `S${index + 1}` }));
}

export function formatEvidence(evidence: readonly ArtifactCitation[]): string {
  if (evidence.length === 0) return 'NO_PROJECT_EVIDENCE';
  return evidence
    .map((item) => `[${item.citationKey}] ${item.title} (${item.locator})\n${item.excerpt}`)
    .join('\n\n');
}

export function usedCitations(
  content: string,
  evidence: readonly ArtifactCitation[],
): ArtifactCitation[] {
  const keys = [...content.matchAll(/\[(S[1-9]\d*)\]/g)].map((match) => match[1] ?? '');
  return [...new Set(keys)]
    .map((key) => evidence.find((item) => item.citationKey === key))
    .filter((item): item is ArtifactCitation => Boolean(item));
}

export function finalizeArtifactContent(content: string, usedEvidence: boolean): string {
  const trimmed = content.trim();
  return usedEvidence ? trimmed : `${trimmed}\n\n> 项目证据：本产物未使用项目知识库证据。`;
}
