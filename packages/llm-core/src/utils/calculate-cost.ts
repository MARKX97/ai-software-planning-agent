import type { CostInfo, ModelPricing, TokenUsage } from '@ai-planning/shared';

/**
 * Calculate the cost of an LLM call from its token usage and model pricing.
 *
 * @internal
 * @param usage Token usage reported by the gateway.
 * @param pricing Model pricing (CNY per 1K tokens).
 */
export function calculateCost(usage: TokenUsage, pricing: ModelPricing): CostInfo {
  const cachedTokens = Math.min(usage.inputTokens, usage.cachedTokens);
  const inputCost = ((usage.inputTokens - cachedTokens) / 1000) * pricing.inputPer1k;
  const cachedInputCost = (cachedTokens / 1000) * (pricing.cachedInputPer1k ?? pricing.inputPer1k);
  const outputCost = (usage.outputTokens / 1000) * pricing.outputPer1k;
  return {
    inputCost,
    outputCost,
    cachedInputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
  };
}
