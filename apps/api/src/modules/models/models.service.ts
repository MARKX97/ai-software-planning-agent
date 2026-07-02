import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { AppException } from '../../common/exception/app-exception.js';
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
 * Static catalog of available LLM models driven by AppConfigService.
 * Real availability probing happens in later phases.
 * @internal
 */
@Injectable()
export class ModelsService {
  constructor(private readonly config: AppConfigService) {}

  list(): ModelInfo[] {
    return PALETTES.map((p) => this.toModelInfo(p));
  }

  get(providerName: string): ModelInfo {
    const palette = PALETTES.find((p) => p.provider_name === providerName);
    if (!palette) {
      throw AppException.notFound(
        ErrorCode.PROVIDER_NOT_FOUND,
        `Model '${providerName}' not found`,
      );
    }
    return this.toModelInfo(palette);
  }

  private toModelInfo(p: Palette): ModelInfo {
    return {
      provider_name: p.provider_name,
      model_id: modelIdByProvider[p.provider_name]?.(this.config) ?? p.provider_name,
      display_name: p.display_name,
      pricing: { input_per_1k: p.input_per_1k, output_per_1k: p.output_per_1k, currency: 'CNY' },
      status: 'available',
      capabilities: p.capabilities,
      max_tokens: p.max_tokens,
      description: p.description,
    };
  }
}
