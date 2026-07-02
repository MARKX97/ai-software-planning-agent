import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ExportsService } from './exports.service.js';
import { exportRequestSchema, type ExportRequest, type ExportResponse } from './exports.dto.js';

const downloadQuerySchema = (v: unknown): string => {
  const token = typeof v === 'string' ? v : '';
  if (!token) {
    throw AppException.badRequest(ErrorCode.INVALID_INPUT, "Query 'token' is required");
  }
  return token;
};

/**
 * Export endpoints — PRD export + status + (stub) download.
 * @internal
 */
@ApiTags('Export')
@Controller('projects/:project_id/export')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Post('prd')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '导出 PRD 文档' })
  @UsePipes(new ZodValidationPipe(exportRequestSchema))
  async createExport(
    @Param('project_id') projectId: string,
    @Body() body: ExportRequest,
  ): Promise<ExportResponse> {
    return this.exports.createExport(projectId, body);
  }

  @Get(':export_id')
  @ApiOperation({ summary: '获取导出任务状态' })
  async getExport(
    @Param('project_id') projectId: string,
    @Param('export_id') exportId: string,
  ): Promise<ExportResponse> {
    return this.exports.getExport(projectId, exportId);
  }

  @Get(':export_id/download')
  @ApiOperation({ summary: '下载导出文件' })
  async download(
    @Param('project_id') projectId: string,
    @Param('export_id') exportId: string,
    @Query('token') token: string,
  ): Promise<ExportResponse> {
    downloadQuerySchema(token);
    return this.exports.getDownload(projectId, exportId);
  }
}
