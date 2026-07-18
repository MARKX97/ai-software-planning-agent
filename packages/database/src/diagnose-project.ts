import { prisma } from './client.js';

const projectId = process.argv[2];

const projectDiagnosticSelect = {
  id: true,
  name: true,
  status: true,
  current_stage: true,
  error_message: true,
  started_at: true,
  completed_at: true,
  updated_at: true,
  workflow_states: {
    orderBy: { created_at: 'asc' },
    select: {
      stage: true,
      status: true,
      progress: true,
      error_message: true,
      started_at: true,
      completed_at: true,
    },
  },
  workflow_executions: {
    orderBy: { started_at: 'desc' },
    take: 20,
    select: {
      id: true,
      stage: true,
      status: true,
      duration_ms: true,
      retry_count: true,
      error_message: true,
      started_at: true,
      completed_at: true,
    },
  },
  conversations: {
    orderBy: { updated_at: 'desc' },
    take: 5,
    select: {
      id: true,
      status: true,
      updated_at: true,
      messages: {
        orderBy: { created_at: 'desc' },
        take: 20,
        select: { role: true, content: true, created_at: true },
      },
    },
  },
  model_execution_logs: {
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      stage: true,
      provider_name: true,
      model_id: true,
      status: true,
      attempt_number: true,
      input_tokens: true,
      output_tokens: true,
      cached_tokens: true,
      cost_total: true,
      latency_ms: true,
      error_code: true,
      error_message: true,
      created_at: true,
    },
  },
  token_usage: true,
} as const;

function summarize(content: string): string {
  const redacted = content
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(/(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  return redacted.length > 240 ? `${redacted.slice(0, 237)}...` : redacted;
}

async function diagnose(id: string): Promise<unknown> {
  const project = await prisma.project.findUnique({
    where: { id },
    select: projectDiagnosticSelect,
  });
  if (!project) throw new Error(`Project '${id}' was not found.`);
  return {
    ...project,
    conversations: project.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.reverse().map((message) => ({
        ...message,
        content: summarize(message.content),
      })),
    })),
  };
}

async function main(): Promise<void> {
  if (!projectId) throw new Error('Usage: pnpm diagnose:project -- <project-id>');
  const result = await diagnose(projectId);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Project diagnosis failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
