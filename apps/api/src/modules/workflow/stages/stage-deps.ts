/**
 * Shared dependencies injected into every stage processor. Bundling them avoids
 * each processor declaring 3+ constructor params (AGENTS.md §1.5).
 *
 * @internal
 */
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { LLMStreamOptions } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';

export interface StageDeps {
  readonly orchestrator: LlmOrchestratorService;
  readonly db: PrismaService;
  readonly dataDir: string;
  readonly stream?: Pick<LLMStreamOptions, 'onDelta' | 'signal'>;
}
