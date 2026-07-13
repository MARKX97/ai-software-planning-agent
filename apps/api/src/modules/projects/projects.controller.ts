import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { ProjectsService } from './projects.service.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  type CreateProjectRequest,
  type ListProjectsQuery,
  type ProjectListResponse,
  type ProjectResponse,
} from './projects.dto.js';

/**
 * Projects endpoints.
 * @internal
 */
@ApiTags('Projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建项目' })
  @ApiResponse({ status: 201, description: '项目创建成功' })
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  async create(@Body() body: CreateProjectRequest): Promise<ProjectResponse> {
    return this.projects.create(body);
  }

  @Get()
  @ApiOperation({ summary: '获取项目列表' })
  @UsePipes(new ZodValidationPipe(listProjectsQuerySchema))
  async list(@Query() query: ListProjectsQuery): Promise<ProjectListResponse> {
    return this.projects.list(query);
  }

  @Get(':project_id')
  @ApiOperation({ summary: '获取项目详情' })
  async get(@Param('project_id', UUID_V4_PIPE) id: string): Promise<ProjectResponse> {
    return this.projects.get(id);
  }

  @Delete(':project_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '软删除项目' })
  async remove(@Param('project_id', UUID_V4_PIPE) id: string): Promise<void> {
    await this.projects.softDelete(id);
  }
}
