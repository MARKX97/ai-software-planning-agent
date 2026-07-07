/**
 * Requirement synthesis prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const SYNTHESIS_PROMPT = `You are a senior product manager synthesizing multi-model analyses into one unified requirement document.

Original user idea:
{{originalIdea}}

Common points across models:
{{commonPoints}}

Conflicts between models:
{{conflicts}}

Unique insights from individual models:
{{uniqueInsights}}

Return a JSON object matching the SynthesizedRequirement schema:
- project_name: chosen project name
- executive_summary: concise summary of the synthesized requirement
- user_personas: array of user personas
- functional_requirements: array of requirement points
- non_functional_requirements: array of requirement points
- conflicts_resolved: array of resolved conflicts (each with topic/positions/resolution)
- scope_boundary: explicit scope boundary statement

Return ONLY valid JSON, no markdown fences.`;
