import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { WorkflowService, type ExecutionLogsListResponse } from './workflow.service.js';
import {
  continueWorkflowSchema,
  advanceWorkflowSchema,
  discussWorkflowSchema,
  type AdvanceWorkflowRequest,
  listExecutionLogsQuerySchema,
  listExecutionsQuerySchema,
  runWorkflowSchema,
  type ContinueWorkflowRequest,
  type DiscussWorkflowRequest,
  type ListExecutionLogsQuery,
  type ListExecutionsQuery,
  type RunWorkflowRequest,
} from './workflow.dto.js';
import type {
  WorkflowExecutionDetailResponse,
  WorkflowExecutionListResponse,
  WorkflowStateListResponse,
  WorkflowStatusResponse,
} from './workflow-response.dto.js';
import { WorkflowSse } from './workflow-sse.js';

/**
 * Workflow endpoints — run, status, continue, states, executions, execution logs.
 * Routes span both `.../workflow/*` and `projects/:project_id/run`; a root
 * `@Controller()` with full paths per route keeps everything in one class.
 *
 * @internal
 */
@ApiTags('Workflow')
@Controller()
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Post('projects/:project_id/run')
  @ApiOperation({ summary: '启动工作流' })
  @UsePipes(new ZodValidationPipe(runWorkflowSchema))
  async run(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Body() body: RunWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    return this.workflow.run(projectId, body, new WorkflowSse(response));
  }

  @Get('projects/:project_id/workflow/status')
  @ApiOperation({ summary: '获取工作流状态' })
  async getStatus(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
  ): Promise<WorkflowStatusResponse> {
    return this.workflow.getStatus(projectId);
  }

  @Post('projects/:project_id/workflow/continue')
  @ApiOperation({ summary: '继续工作流' })
  @UsePipes(new ZodValidationPipe(continueWorkflowSchema))
  async continue(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Body() body: ContinueWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    return this.workflow.continue(projectId, body, new WorkflowSse(response));
  }

  @Post('projects/:project_id/workflow/discuss')
  @ApiOperation({ summary: '讨论当前检查点' })
  @UsePipes(new ZodValidationPipe(discussWorkflowSchema))
  async discuss(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Body() body: DiscussWorkflowRequest,
    @Res() response: Response,
  ): Promise<void> {
    return this.workflow.discuss(projectId, body, new WorkflowSse(response));
  }

  @Post('projects/:project_id/workflow/advance')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '确认并进入下一环节' })
  @UsePipes(new ZodValidationPipe(advanceWorkflowSchema))
  async advance(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Body() body: AdvanceWorkflowRequest,
  ): Promise<WorkflowStatusResponse> {
    return this.workflow.advance(projectId, body);
  }

  @Get('projects/:project_id/workflow/states')
  @ApiOperation({ summary: '获取工作流各阶段状态' })
  async listStates(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
  ): Promise<WorkflowStateListResponse> {
    return this.workflow.listStates(projectId);
  }

  @Get('projects/:project_id/workflow/executions')
  @ApiOperation({ summary: '获取工作流执行历史' })
  @UsePipes(new ZodValidationPipe(listExecutionsQuerySchema))
  async listExecutions(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Query() query: ListExecutionsQuery,
  ): Promise<WorkflowExecutionListResponse> {
    return this.workflow.listExecutions(projectId, query);
  }

  @Get('projects/:project_id/workflow/executions/:execution_id')
  @ApiOperation({ summary: '获取执行详情' })
  async getExecution(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('execution_id', UUID_V4_PIPE) executionId: string,
  ): Promise<WorkflowExecutionDetailResponse> {
    return this.workflow.getExecution(projectId, executionId);
  }

  @Get('projects/:project_id/workflow/executions/:execution_id/logs')
  @ApiOperation({ summary: '获取执行关联的模型调用日志' })
  @UsePipes(new ZodValidationPipe(listExecutionLogsQuerySchema))
  async listExecutionLogs(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('execution_id', UUID_V4_PIPE) executionId: string,
    @Query() query: ListExecutionLogsQuery,
  ): Promise<ExecutionLogsListResponse> {
    return this.workflow.listExecutionLogs(projectId, executionId, query);
  }
}
