import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { UsageService } from '../../src/modules/usage/usage.service.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

function log(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    project_id: 'project-1',
    execution_id: null,
    stage: 'requirement_analysis',
    provider_name: 'deepseek',
    model_id: 'model',
    status: 'success',
    attempt_number: 1,
    prompt_version_id: null,
    prompt_text: 'prompt',
    response_text: 'response',
    structured_output: null,
    input_tokens: 10,
    output_tokens: 5,
    cached_tokens: 2,
    cost_input: 0.1,
    cost_output: 0.2,
    cost_cached: 0,
    cost_total: 0.3,
    latency_ms: 100,
    error_code: null,
    error_message: null,
    created_at: createdAt,
    ...overrides,
  } as never;
}

describe('UsageService', () => {
  it('aggregates providers, stages, latency and budget state', async () => {
    const usage = {
      project_id: 'project-1',
      total_input_tokens: 30,
      total_output_tokens: 10,
      total_cached_tokens: 2,
      total_tokens: 42,
      total_cost: 4.2,
      call_count: 2,
      success_count: 1,
      failed_count: 1,
      timeout_count: 0,
      rate_limited_count: 0,
      avg_latency_ms: 150,
      updated_at: createdAt,
    } as never;
    const logs = [
      log(),
      log({ id: 'log-2', status: 'failed', cost_total: 0.2, latency_ms: 200 }),
      log({
        id: 'log-3',
        provider_name: 'glm',
        stage: 'risk_analysis',
        cost_total: 0.1236,
        latency_ms: null,
      }),
    ];
    const db = {
      client: {
        tokenUsage: { findUnique: async () => usage },
        modelExecutionLog: { findMany: async () => logs },
      },
    };
    const service = new UsageService(
      db as never,
      { costLimitPerProject: 5 } as never,
      { findOrFail: async () => ({}) } as never,
    );
    const result = await service.getTokenUsageDetail({ project_id: 'project-1' });
    assert.deepEqual(result.by_provider[0], {
      provider_name: 'deepseek',
      call_count: 2,
      success_count: 1,
      failed_count: 1,
      total_input_tokens: 20,
      total_output_tokens: 10,
      total_cached_tokens: 4,
      total_cost: 0.5,
      avg_latency_ms: 150,
    });
    assert.equal(result.by_provider[1]?.total_cost, 0.124);
    assert.equal(result.by_provider[1]?.avg_latency_ms, null);
    assert.deepEqual(result.cost_limit, {
      max_cost_per_project: 5,
      remaining: 0.7999999999999998,
      alert_triggered: true,
    });
  });

  it('applies every log filter and pagination option', async () => {
    let findArgs: unknown;
    const db = {
      client: {
        modelExecutionLog: {
          findMany: async (args: unknown) => {
            findArgs = args;
            return [log()];
          },
          count: async () => 1,
        },
      },
    };
    const service = new UsageService(
      db as never,
      {} as never,
      { findOrFail: async () => ({}) } as never,
    );
    const result = await service.listLogs('project-1', {
      offset: 10,
      limit: 5,
      provider_name: 'deepseek',
      stage: 'requirement_analysis',
      status: 'success',
    });
    assert.deepEqual(findArgs, {
      where: {
        project_id: 'project-1',
        provider_name: 'deepseek',
        stage: 'requirement_analysis',
        status: 'success',
      },
      orderBy: { created_at: 'desc' },
      skip: 10,
      take: 5,
    });
    assert.equal(result.items[0]?.cost_total, 0.3);
  });

  it('rejects a model log from another project', async () => {
    const db = {
      client: { modelExecutionLog: { findUnique: async () => log({ project_id: 'project-2' }) } },
    };
    const service = new UsageService(
      db as never,
      {} as never,
      { findOrFail: async () => ({}) } as never,
    );
    await assert.rejects(
      () => service.getLog('project-1', 'log-1'),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.EXECUTION_NOT_FOUND,
    );
  });
});
