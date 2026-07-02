import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/guards/public.decorator.js';
import { ModelsService } from './models.service.js';
import type { ModelInfo, ModelListResponse } from './models.dto.js';

/**
 * Models endpoints — free-auth per specs/api.spec.md §2.
 * @internal
 */
@ApiTags('Models')
@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '获取可用 AI 模型列表' })
  list(): ModelListResponse {
    const items = this.models.list();
    return { items, total: items.length };
  }

  @Public()
  @Get(':provider_name')
  @ApiOperation({ summary: '获取指定模型详情' })
  detail(@Param('provider_name') providerName: string): ModelInfo {
    return this.models.get(providerName);
  }
}
