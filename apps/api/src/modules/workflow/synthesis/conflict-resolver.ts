import type { MultiModelAnalysisResult } from '@ai-planning/shared';

export interface ResolvedConflict {
  readonly topic: string;
  readonly positions: string[];
  readonly resolution: string;
}

export interface SynthesisInputs {
  readonly commonPoints: string;
  readonly conflicts: string;
  readonly uniqueInsights: string;
}

type ProviderAnalysis = MultiModelAnalysisResult & { provider: string };

/** Builds deterministic synthesis inputs from successful model analyses. */
export class ConflictResolver {
  resolve(outputs: Record<string, unknown>): SynthesisInputs {
    const analyses = this.toAnalyses(outputs);
    return {
      commonPoints: JSON.stringify(this.collectCommonPoints(analyses)),
      conflicts: JSON.stringify(this.collectConflicts(analyses)),
      uniqueInsights: JSON.stringify(this.collectUniqueInsights(analyses)),
    };
  }

  private toAnalyses(outputs: Record<string, unknown>): ProviderAnalysis[] {
    return Object.entries(outputs)
      .filter(([, value]) => this.isAnalysis(value))
      .map(([provider, value]) => ({ ...(value as MultiModelAnalysisResult), provider }));
  }

  private isAnalysis(value: unknown): value is MultiModelAnalysisResult {
    return typeof value === 'object' && value !== null && 'recommendation' in value;
  }

  private collectCommonPoints(analyses: ProviderAnalysis[]): string[] {
    const titles = new Map<string, number>();
    for (const analysis of analyses) {
      for (const point of analysis.requirement_points) {
        titles.set(point.title, (titles.get(point.title) ?? 0) + 1);
      }
    }
    return [...titles.entries()].filter(([, count]) => count > 1).map(([title]) => title);
  }

  private collectConflicts(analyses: ProviderAnalysis[]): ResolvedConflict[] {
    const risky = analyses.filter((a) => a.weaknesses.length > 0 || a.unknowns.length > 0);
    return risky.map((analysis) => ({
      topic: `${analysis.provider} concerns`,
      positions: [...analysis.weaknesses, ...analysis.unknowns],
      resolution: analysis.recommendation,
    }));
  }

  private collectUniqueInsights(analyses: ProviderAnalysis[]): Record<string, string[]> {
    return Object.fromEntries(
      analyses.map((analysis) => [
        analysis.provider,
        [...analysis.strengths, analysis.recommendation],
      ]),
    );
  }
}
