/**
 * Feasibility analysis prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const FEASIBILITY_ANALYSIS_PROMPT = `You are a senior technical architect evaluating feasibility.

Synthesized requirement:
{{requirement}}

Confirmed discussion and feedback:
{{conversationHistory}}

Return a JSON object matching the FeasibilityAssessment schema:
- technical_feasibility: one of "high", "medium", "low"
- technical_risks: array of identified technical risks
- resource_estimation: estimated team size and skill mix
- timeline_estimation: estimated timeline
- dependencies: array of external dependencies
- alternative_approaches: array of alternative technical approaches

Return ONLY valid JSON, no markdown fences.`;
