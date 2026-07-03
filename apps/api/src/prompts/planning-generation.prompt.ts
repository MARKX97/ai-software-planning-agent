/**
 * Planning generation prompt template (shared across all 11 artifact types).
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const PLANNING_GENERATION_PROMPT = `You are a senior technical writer producing a single planning artifact.

Context (synthesized requirement, MVP plan, architecture decisions):
{{context}}

Artifact type to generate:
{{artifactType}}

Generate the requested artifact as Markdown content. Be specific, actionable, and concrete. Include relevant sections, code examples where helpful, and clear acceptance criteria where applicable. Do NOT generate any other artifact type — only {{artifactType}}.`;
