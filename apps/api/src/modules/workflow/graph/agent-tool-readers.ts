import type { AgentToolAction } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { AppException } from '../../../common/exception/app-exception.js';
import { ErrorCode } from '../../../common/exception/error-code.js';
import { redactSensitiveText } from '../../../common/security/sensitive-text.js';
import type { KnowledgeRetrievalService } from '../../knowledge/knowledge-retrieval.service.js';

export interface ToolReadResult {
  readonly resultCount: number;
  readonly summary: string;
  readonly context: string;
}

export interface AgentToolReaderDeps {
  readonly db: PrismaService;
  readonly knowledge: KnowledgeRetrievalService;
}

export async function readAgentTool(
  deps: AgentToolReaderDeps,
  projectId: string,
  action: AgentToolAction,
): Promise<ToolReadResult> {
  switch (action.tool) {
    case 'searchKnowledge':
      return searchKnowledge(deps, projectId, action.input);
    case 'readSource':
      return readSource(deps.db, projectId, action.input);
    case 'inspectRepository':
      return inspectRepository(deps, projectId, action.input);
    case 'getArtifact':
      return getArtifact(deps.db, projectId, action.input);
  }
}

async function searchKnowledge(
  deps: AgentToolReaderDeps,
  projectId: string,
  input: Extract<AgentToolAction, { tool: 'searchKnowledge' }>['input'],
): Promise<ToolReadResult> {
  const result = await deps.knowledge.search(projectId, {
    query: input.query,
    source_ids: input.sourceIds,
    top_k: input.topK,
  });
  return toolResult(result.items.length, `${result.items.length} 条知识证据`, result.items);
}

async function readSource(
  db: PrismaService,
  projectId: string,
  input: Extract<AgentToolAction, { tool: 'readSource' }>['input'],
): Promise<ToolReadResult> {
  const document = await db.client.knowledgeDocument.findFirst({
    where: {
      id: input.documentId,
      revision: {
        is_active: true,
        source: { project_id: projectId, deleted_at: null },
      },
    },
    include: { chunks: { orderBy: { position: 'asc' }, take: 50 } },
  });
  if (!document) throw toolNotFound('Source document is unavailable');
  const chunks = document.chunks.filter(
    (chunk) =>
      input.locator === document.logical_path || locator(document, chunk) === input.locator,
  );
  if (chunks.length === 0) throw toolNotFound('Source locator is unavailable');
  return toolResult(chunks.length, `${document.title} · ${chunks.length} 个片段`, {
    documentId: document.id,
    title: document.title,
    chunks: chunks.map((chunk) => ({ locator: locator(document, chunk), content: chunk.content })),
  });
}

async function inspectRepository(
  deps: AgentToolReaderDeps,
  projectId: string,
  input: Extract<AgentToolAction, { tool: 'inspectRepository' }>['input'],
): Promise<ToolReadResult> {
  const source = await deps.db.client.knowledgeSource.findFirst({
    where: {
      id: input.sourceId,
      project_id: projectId,
      kind: 'github_repository',
      deleted_at: null,
      status: { in: ['ready', 'ready_with_warnings'] },
    },
    select: { id: true },
  });
  if (!source) throw toolNotFound('Repository source is unavailable');
  if (input.query) {
    const result = await deps.knowledge.search(projectId, {
      query: input.query,
      source_ids: [source.id],
      top_k: 8,
    });
    return toolResult(result.items.length, `${result.items.length} 条仓库证据`, result.items);
  }
  const prefix = input.path === '.' ? '' : (input.path ?? '');
  const documents = await deps.db.client.knowledgeDocument.findMany({
    where: {
      source_id: source.id,
      logical_path: { startsWith: prefix },
      revision: { is_active: true },
    },
    orderBy: { logical_path: 'asc' },
    take: 40,
    include: { chunks: { orderBy: { position: 'asc' }, take: 2 } },
  });
  return toolResult(documents.length, `${documents.length} 个仓库文件`, {
    path: input.path,
    files: documents.map((document) => ({
      documentId: document.id,
      path: document.logical_path,
      commit: document.repository_commit,
      excerpts: document.chunks.map((chunk) => ({
        locator: locator(document, chunk),
        content: chunk.content,
      })),
    })),
  });
}

async function getArtifact(
  db: PrismaService,
  projectId: string,
  input: Extract<AgentToolAction, { tool: 'getArtifact' }>['input'],
): Promise<ToolReadResult> {
  const artifact = await db.client.artifact.findFirst({
    where: { project_id: projectId, type: input.artifactType, deleted_at: null },
    orderBy: { created_at: 'desc' },
  });
  if (!artifact) throw toolNotFound('Artifact is unavailable');
  return toolResult(1, artifact.type_display_name, {
    artifactId: artifact.id,
    type: artifact.type,
    title: artifact.title,
    content: artifact.content,
  });
}

function locator(
  document: { logical_path: string; repository_commit: string | null },
  chunk: { page_number: number | null; line_start: number | null; line_end: number | null },
): string {
  if (chunk.page_number) return `${document.logical_path}:page-${chunk.page_number}`;
  if (chunk.line_start && chunk.line_end) {
    const lines = `${document.logical_path}:L${chunk.line_start}-L${chunk.line_end}`;
    return document.repository_commit ? `${lines}@${document.repository_commit}` : lines;
  }
  return document.logical_path;
}

function toolResult(resultCount: number, summary: string, value: unknown): ToolReadResult {
  const context = redactSensitiveText(JSON.stringify(value)).slice(0, 8_000);
  return { resultCount, summary: redactSensitiveText(summary).slice(0, 300), context };
}

function toolNotFound(message: string): AppException {
  return AppException.notFound(ErrorCode.KNOWLEDGE_SOURCE_NOT_FOUND, message);
}
