/**
 * Platform recommendation prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const PLATFORM_RECOMMENDATION_PROMPT = `You are a senior architect recommending a tech stack.

MVP plan:
{{mvp}}

Synthesized requirement:
{{requirement}}

Confirmed discussion and feedback:
{{conversationHistory}}

Return a JSON object matching the PlatformRecommendation schema:
- recommended_platform: recommended primary platform/framework
- tech_stack: array of recommended technologies
- rationale: justification for the recommendation
- alternatives: array of alternative platforms considered
- trade_offs: trade-offs of the chosen stack

Return ONLY valid JSON, no markdown fences.`;
