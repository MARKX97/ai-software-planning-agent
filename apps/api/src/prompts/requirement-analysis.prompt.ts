/**
 * Requirement analysis prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const REQUIREMENT_ANALYSIS_PROMPT = `You are a senior product manager. Analyze the following user idea and produce a structured requirement analysis.

User idea:
{{idea}}

Conversation history so far (if any):
{{conversationHistory}}

Return a JSON object matching the RequirementAnalysisResult schema:
- project_summary: one-line summary of the project
- target_users: array of target user personas
- core_problems: array of core problems the project solves
- requirement_points: array of requirement points (each with id/title/description/priority/category)
- assumptions: array of assumptions made during analysis
- clarification_questions: array of questions needing user clarification (empty if none)

Return ONLY valid JSON, no markdown fences.`;
