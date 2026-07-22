import type { ArtifactType } from '@ai-planning/database';
import {
  artifactQualityReportSchema,
  type ArtifactQualityCheck,
  type ArtifactQualityReport,
} from '@ai-planning/shared';
import { ARTIFACT_TYPES } from '../stages/model-routing.js';

export type ArtifactQualityIssueId = Exclude<ArtifactQualityCheck['id'], 'artifact_coverage'>;

const MIN_CONTENT_CHARACTERS = 120;

const RULES: ReadonlyArray<{
  readonly id: ArtifactQualityIssueId;
  readonly label: string;
  readonly passes: (content: string) => boolean;
}> = [
  {
    id: 'markdown_structure',
    label: 'Markdown 结构',
    passes: (content) => /^#\s+\S/m.test(content),
  },
  {
    id: 'substantive_content',
    label: '有效内容',
    passes: (content) => content.replace(/\s/g, '').length >= MIN_CONTENT_CHARACTERS,
  },
  {
    id: 'unresolved_placeholders',
    label: '模板完整性',
    passes: (content) => !/\{\{[^}]+\}\}/.test(content),
  },
];

export function inspectArtifact(content: string): ArtifactQualityIssueId[] {
  return RULES.filter((rule) => !rule.passes(content.trim())).map((rule) => rule.id);
}

export function artifactQualityReportFromState(data: unknown): ArtifactQualityReport | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const parsed = artifactQualityReportSchema.safeParse(
    (data as Record<string, unknown>)['quality_report'],
  );
  return parsed.success ? parsed.data : null;
}

export function buildArtifactQualityReport(input: {
  readonly generatedTypes: readonly ArtifactType[];
  readonly failures: ReadonlyArray<{
    readonly type: ArtifactType;
    readonly qualityIssues: readonly ArtifactQualityIssueId[];
  }>;
  readonly revisedTypes: readonly ArtifactType[];
}): ArtifactQualityReport {
  const missing = ARTIFACT_TYPES.filter((type) => !input.generatedTypes.includes(type));
  const checks: ArtifactQualityCheck[] = [
    check({
      id: 'artifact_coverage',
      label: '产物覆盖',
      affectedArtifacts: missing,
      message: `${input.generatedTypes.length}/${ARTIFACT_TYPES.length} 类产物已生成`,
    }),
    ...RULES.map((rule) => {
      const affected = input.failures
        .filter((failure) => failure.qualityIssues.includes(rule.id))
        .map((failure) => failure.type);
      return check({
        id: rule.id,
        label: rule.label,
        affectedArtifacts: affected,
        message: affected.length ? '修订后仍未达标' : '全部达标',
      });
    }),
  ];
  return artifactQualityReportSchema.parse({
    status: checks.some((item) => item.status === 'warning') ? 'warning' : 'passed',
    expected_artifacts: 11,
    generated_artifacts: input.generatedTypes.length,
    checks,
    revised_artifacts: input.revisedTypes,
  });
}

function check(input: {
  readonly id: ArtifactQualityCheck['id'];
  readonly label: string;
  readonly affectedArtifacts: ArtifactType[];
  readonly message: string;
}): ArtifactQualityCheck {
  return {
    id: input.id,
    label: input.label,
    status: input.affectedArtifacts.length > 0 ? 'warning' : 'passed',
    affected_artifacts: input.affectedArtifacts,
    message: input.message,
  };
}
