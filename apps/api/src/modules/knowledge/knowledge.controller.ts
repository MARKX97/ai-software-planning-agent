import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { KnowledgeSource } from '@ai-planning/shared';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { KnowledgeService } from './knowledge.service.js';
import type { KnowledgeSourceListResponse } from './knowledge.dto.js';
import type { UploadedKnowledgeFile } from './knowledge-parser.js';

@ApiTags('Knowledge')
@Controller('projects/:project_id/knowledge/sources')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  @ApiOperation({ summary: '上传并索引 Markdown 或 TXT 知识源' })
  async create(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @UploadedFile() file: UploadedKnowledgeFile,
    @Res({ passthrough: true }) response: Response,
  ): Promise<KnowledgeSource> {
    const result = await this.knowledge.create(projectId, file);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.source;
  }

  @Get()
  @ApiOperation({ summary: '获取项目知识源' })
  list(@Param('project_id', UUID_V4_PIPE) projectId: string): Promise<KnowledgeSourceListResponse> {
    return this.knowledge.list(projectId);
  }

  @Post(':source_id/reindex')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重新索引知识源' })
  reindex(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('source_id', UUID_V4_PIPE) sourceId: string,
  ): Promise<KnowledgeSource> {
    return this.knowledge.reindex(projectId, sourceId);
  }

  @Delete(':source_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除知识源' })
  remove(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('source_id', UUID_V4_PIPE) sourceId: string,
  ): Promise<void> {
    return this.knowledge.remove(projectId, sourceId);
  }
}
