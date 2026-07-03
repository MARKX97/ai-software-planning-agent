/**
 * Multi-model analysis prompt template (shared across all 3 models).
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const MULTI_MODEL_ANALYSIS_PROMPT = `You are an independent technical analyst. Analyze the following requirement from your own perspective.

Requirement:
{{requirement}}

Return a JSON object matching the MultiModelAnalysisResult schema:
- model_name: your model identifier (e.g. "deepseek", "glm", "minimax")
- requirement_points: array of requirement points you identify
- strengths: array of strengths you see in the requirement
- weaknesses: array of weaknesses or gaps you see
- unknowns: array of unknowns requiring clarification
- recommendation: your overall recommendation

Return ONLY valid JSON, no markdown fences. Provide your own independent perspective.`;
