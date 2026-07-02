import { Controller, Get, HttpCode, HttpStatus, Param, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UsageService } from './usage.service.js';
import {
  listLogsQuerySchema,
  tokenUsageQuerySchema,
  type ListLogsQuery,
  type ModelExecutionLogDetailResponse,
  type ModelExecutionLogListResponse,
  type TokenUsageDetailResponse,
  type TokenUsageQuery,
} from './usage.dto.js';

/**
 * Usage endpoints — token stats + model execution log queries.
 * @internal
 */
@ApiTags('Token Usage')
@Controller()
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get('usage/tokens')
  @ApiOperation({ summary: '获取 Token 用量与成本统计' })
  @UsePipes(new ZodValidationPipe(tokenUsageQuerySchema))
  async getTokenUsage(@Query() query: TokenUsageQuery): Promise<TokenUsageDetailResponse> {
    return this.usage.getTokenUsageDetail(query);
  }

  @Get('projects/:project_id/usage/logs')
  @ApiOperation({ summary: '获取模型调用日志' })
  @UsePipes(new ZodValidationPipe(listLogsQuerySchema))
  async listLogs(
    @Param('project_id') projectId: string,
    @Query() query: ListLogsQuery,
  ): Promise<ModelExecutionLogListResponse> {
    return this.usage.listLogs(projectId, query);
  }

  @Get('projects/:project_id/usage/logs/:log_id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取单条模型调用日志详情' })
  async getLog(
    @Param('project_id') projectId: string,
    @Param('log_id') logId: string,
  ): Promise<ModelExecutionLogDetailResponse> {
    return this.usage.getLog(projectId, logId);
  }
}
