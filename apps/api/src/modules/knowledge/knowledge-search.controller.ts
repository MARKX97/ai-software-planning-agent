import { Body, Controller, HttpCode, HttpStatus, Param, Post, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  knowledgeSearchRequestSchema,
  type KnowledgeSearchRequest,
  type KnowledgeSearchResponse,
} from '@ai-planning/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service.js';

@ApiTags('Knowledge')
@Controller('projects/:project_id/knowledge')
export class KnowledgeSearchController {
  constructor(private readonly retrieval: KnowledgeRetrievalService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '预览项目内混合证据检索' })
  @UsePipes(new ZodValidationPipe(knowledgeSearchRequestSchema))
  search(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Body() body: KnowledgeSearchRequest,
  ): Promise<KnowledgeSearchResponse> {
    return this.retrieval.search(projectId, body);
  }
}
