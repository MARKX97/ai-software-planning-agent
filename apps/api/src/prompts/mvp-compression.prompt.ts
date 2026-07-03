/**
 * MVP compression prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const MVP_COMPRESSION_PROMPT = `You are a product manager defining an MVP scope.

Synthesized requirement:
{{requirement}}

Identified risks:
{{risks}}

Feasibility assessment:
{{feasibility}}

Return a JSON object matching the MVPPlan schema:
- mvp_scope: array of features included in MVP
- deferred_scope: array of features deferred to later phases
- mvp_goal: single-sentence MVP goal
- success_metrics: array of measurable success metrics
- timeline: MVP timeline estimate
- milestones: array of MVP milestones

Return ONLY valid JSON, no markdown fences.`;
