import { Inject, Injectable } from '@nestjs/common';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { AppConfigService } from '../../config/app-config.service.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { AppException } from '../../common/exception/app-exception.js';
import { LLM_ORCHESTRATOR } from '../../llm/llm.constants.js';
import type { ModelInfo } from './models.dto.js';

interface Palette {
  provider_name: string;
  display_name: string;
  max_tokens: number;
  capabilities: string[];
  input_per_1k: number;
  output_per_1k: number;
  description: string;
}

const PALETTES: Palette[] = [
  {
    provider_name: 'deepseek',
    display_name: 'DeepSeek V4 Pro',
    max_tokens: 8192,
    capabilities: ['chat', 'structured_output', 'function_calling', 'json_mode'],
    input_per_1k: 0.002,
    output_per_1k: 0.008,
    description: 'DeepSeek 最新旗舰模型，擅长推理和代码生成',
  },
  {
    provider_name: 'glm',
    display_name: 'GLM 5.1',
    max_tokens: 4096,
    capabilities: ['chat', 'structured_output', 'function_calling'],
    input_per_1k: 0.001,
    output_per_1k: 0.001,
    description: '智谱 AI 最新模型，中英文能力强',
  },
  {
    provider_name: 'minimax',
    display_name: 'MiniMax M2.5',
    max_tokens: 4096,
    capabilities: ['chat', 'structured_output'],
    input_per_1k: 0.001,
    output_per_1k: 0.001,
    description: 'MiniMax 最新模型，性价比高',
  },
];

const modelIdByProvider: Record<string, (c: AppConfigService) => string> = {
  deepseek: (c) => c.modelDeepseek,
  glm: (c) => c.modelGlm,
  minimax: (c) => c.modelMinimax,
};

/**
 * Catalog of available LLM models driven by AppConfigService, with per-model
 * availability derived from the orchestrator's live health check.
 * @internal
 */
@Injectable()
export class ModelsService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(LLM_ORCHESTRATOR) private readonly orchestrator: LlmOrchestratorService,
  ) {}

  async list(): Promise<ModelInfo[]> {
    const health = await this.orchestrator.healthCheck();
    return PALETTES.map((p) => this.toModelInfo(p, health[p.provider_name] === true));
  }

  async get(providerName: string): Promise<ModelInfo> {
    const palette = PALETTES.find((p) => p.provider_name === providerName);
    if (!palette) {
      throw AppException.notFound(
        ErrorCode.PROVIDER_NOT_FOUND,
        `Model '${providerName}' not found`,
      );
    }
    const health = await this.orchestrator.healthCheck();
    return this.toModelInfo(palette, health[providerName] === true);
  }

  private toModelInfo(p: Palette, available: boolean): ModelInfo {
    return {
      provider_name: p.provider_name,
      model_id: modelIdByProvider[p.provider_name]?.(this.config) ?? p.provider_name,
      display_name: p.display_name,
      pricing: { input_per_1k: p.input_per_1k, output_per_1k: p.output_per_1k, currency: 'CNY' },
      status: available ? 'available' : 'unavailable',
      capabilities: p.capabilities,
      max_tokens: p.max_tokens,
      description: p.description,
    };
  }
}
