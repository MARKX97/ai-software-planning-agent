import { Global, Module } from '@nestjs/common';
import { createLlmOrchestrator } from '@ai-planning/llm-orchestrator';
import { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { AppConfigService } from '../config/app-config.service.js';
import { LLM_ORCHESTRATOR } from './llm.constants.js';

/**
 * Global module that wires the {@link LlmOrchestratorService} using the
 * resolved app config. The orchestrator is the only LLM surface apps/api is
 * allowed to depend on (per spec §7).
 *
 * @internal
 */
@Global()
@Module({
  providers: [
    {
      provide: LLM_ORCHESTRATOR,
      // An empty key selects deterministic providers for the local interactive demo.
      useFactory: (config: AppConfigService): LlmOrchestratorService =>
        createLlmOrchestrator({
          baseUrl: config.baishanBaseUrl,
          apiKey: config.baishanApiKey,
          modelIds: {
            deepseek: config.modelDeepseek,
            glm: config.modelGlm,
            minimax: config.modelMinimax,
          },
          costLimitPerProject: config.costLimitPerProject,
        }),
      inject: [AppConfigService],
    },
  ],
  exports: [LLM_ORCHESTRATOR],
})
export class OrchestratorModule {}
