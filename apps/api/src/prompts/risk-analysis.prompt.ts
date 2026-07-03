/**
 * Risk analysis prompt template.
 *
 * Source: `specs/prompt.spec.md` §1.
 * @internal
 */
export const RISK_ANALYSIS_PROMPT = `You are a risk analyst identifying project risks.

Synthesized requirement:
{{requirement}}

Feasibility assessment:
{{feasibility}}

Return a JSON object matching the RiskAnalysisResult schema:
- risks: array of risk items (each with id/category/description/probability/impact/mitigation/contingency)
- overall_risk_level: one of "high", "medium", "low"
- critical_risks: array of risk ids deemed critical

Return ONLY valid JSON, no markdown fences.`;
