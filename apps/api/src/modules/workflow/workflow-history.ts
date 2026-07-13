import type { PrismaService } from '../../database/database.module.js';
import { toModelExecutionLogResponse, type ModelExecutionLogResponse } from '../usage/usage.dto.js';
import {
  toWorkflowExecutionDetailResponse,
  toWorkflowExecutionResponse,
  toWorkflowStateResponse,
  type WorkflowExecutionDetailResponse,
  type WorkflowExecutionListResponse,
  type WorkflowExecutionResponse,
  type WorkflowStateListResponse,
} from './workflow-response.dto.js';
import type { ListExecutionLogsQuery, ListExecutionsQuery } from './workflow.dto.js';
import { countModelLogs, findExecutionOrFail } from './workflow-store.js';

export interface ExecutionLogsListResponse {
  items: ModelExecutionLogResponse[];
  total: number;
  offset: number;
  limit: number;
}

export async function listWorkflowStates(
  db: PrismaService,
  projectId: string,
): Promise<WorkflowStateListResponse> {
  const items = await db.client.workflowState.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'asc' },
  });
  return { items: items.map(toWorkflowStateResponse), total: items.length };
}

export async function listWorkflowExecutions(
  db: PrismaService,
  projectId: string,
  query: ListExecutionsQuery,
): Promise<WorkflowExecutionListResponse> {
  const where = {
    project_id: projectId,
    ...(query.stage ? { stage: query.stage as never } : {}),
    ...(query.status ? { status: query.status as never } : {}),
  };
  const [rows, total] = await Promise.all([
    db.client.workflowExecution.findMany({
      where,
      orderBy: { started_at: 'desc' },
      skip: query.offset,
      take: query.limit,
    }),
    db.client.workflowExecution.count({ where }),
  ]);
  const counts = await countModelLogs(db, rows);
  const items: WorkflowExecutionResponse[] = rows.map((row, index) =>
    toWorkflowExecutionResponse(row, counts[index]),
  );
  return { items, total, offset: query.offset, limit: query.limit };
}

export async function getWorkflowExecution(
  db: PrismaService,
  projectId: string,
  executionId: string,
): Promise<WorkflowExecutionDetailResponse> {
  const execution = await findExecutionOrFail(db, projectId, executionId);
  const logs = await db.client.modelExecutionLog.findMany({
    where: { execution_id: executionId },
    orderBy: { created_at: 'asc' },
  });
  return toWorkflowExecutionDetailResponse(execution, logs.length, logs);
}

export async function listWorkflowExecutionLogs(
  db: PrismaService,
  projectId: string,
  executionId: string,
  query: ListExecutionLogsQuery,
): Promise<ExecutionLogsListResponse> {
  await findExecutionOrFail(db, projectId, executionId);
  const where = { execution_id: executionId };
  const [rows, total] = await Promise.all([
    db.client.modelExecutionLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: query.offset,
      take: query.limit,
    }),
    db.client.modelExecutionLog.count({ where }),
  ]);
  return {
    items: rows.map(toModelExecutionLogResponse),
    total,
    offset: query.offset,
    limit: query.limit,
  };
}
