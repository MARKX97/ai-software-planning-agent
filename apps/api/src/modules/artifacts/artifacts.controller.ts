import { Controller, Get, HttpCode, HttpStatus, Param, Query, Res, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { ArtifactsService } from './artifacts.service.js';
import {
  listArtifactsQuerySchema,
  type ArtifactListResponse,
  type ArtifactResponse,
  type ListArtifactsQuery,
} from './artifacts.dto.js';

/**
 * Artifacts endpoints.
 * @internal
 */
@ApiTags('Artifacts')
@Controller('projects/:project_id/artifacts')
export class ArtifactsController {
  constructor(private readonly artifacts: ArtifactsService) {}

  @Get()
  @ApiOperation({ summary: '获取产物列表' })
  @UsePipes(new ZodValidationPipe(listArtifactsQuerySchema))
  async list(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Query() query: ListArtifactsQuery,
  ): Promise<ArtifactListResponse> {
    return this.artifacts.list(projectId, query);
  }

  @Get(':artifact_id')
  @ApiOperation({ summary: '获取产物详情' })
  async get(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('artifact_id', UUID_V4_PIPE) artifactId: string,
  ): Promise<ArtifactResponse> {
    return this.artifacts.get(projectId, artifactId);
  }

  @Get(':artifact_id/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '下载产物文件' })
  async download(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('artifact_id', UUID_V4_PIPE) artifactId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, filename } = await this.artifacts.getDownload(projectId, artifactId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
