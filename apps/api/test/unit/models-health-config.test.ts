import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { AppConfigService } from '../../src/config/app-config.service.js';
import { HealthService } from '../../src/health/health.service.js';
import { ModelsService } from '../../src/modules/models/models.service.js';

describe('ModelsService', () => {
  const config = {
    modelDeepseek: 'deepseek-id',
    modelGlm: 'glm-id',
    modelMinimax: 'minimax-id',
  } as never;

  it('maps configured model ids and live provider health', async () => {
    const service = new ModelsService(config, {
      healthCheck: async () => ({ deepseek: true, glm: false, minimax: true }),
    } as never);
    const items = await service.list();
    assert.deepEqual(
      items.map((item) => [item.provider_name, item.model_id, item.status]),
      [
        ['deepseek', 'deepseek-id', 'available'],
        ['glm', 'glm-id', 'unavailable'],
        ['minimax', 'minimax-id', 'available'],
      ],
    );
  });

  it('rejects an unknown provider without calling health check', async () => {
    let called = false;
    const service = new ModelsService(config, {
      healthCheck: async () => {
        called = true;
        return {};
      },
    } as never);
    await assert.rejects(
      () => service.get('unknown'),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.PROVIDER_NOT_FOUND,
    );
    assert.equal(called, false);
  });
});

describe('HealthService', () => {
  it('reports ok only when database and every provider are healthy', async () => {
    const service = new HealthService(
      { client: { $queryRaw: async () => [1] } } as never,
      { version: '2.0.0' } as never,
      { healthCheck: async () => ({ deepseek: true, glm: true }) } as never,
    );
    const result = await service.check();
    assert.equal(result.status, 'ok');
    assert.equal(result.database, 'ok');
    assert.equal(result.version, '2.0.0');
  });

  it('degrades when the database or a provider is unavailable', async () => {
    const service = new HealthService(
      { client: { $queryRaw: async () => Promise.reject(new Error('offline')) } } as never,
      { version: '' } as never,
      { healthCheck: async () => ({ deepseek: false }) } as never,
    );
    const result = await service.check();
    assert.deepEqual(
      { status: result.status, database: result.database, providers: result.llm_providers },
      { status: 'degraded', database: 'error', providers: { deepseek: 'unavailable' } },
    );
  });
});

describe('AppConfigService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses valid environment values and uses API key as download secret', () => {
    process.env = {
      ...originalEnv,
      API_PORT: '4100',
      API_KEY: 'api-test-key',
      COST_MAX_COST_PER_PROJECT: '9.5',
      WORKFLOW_RATE_LIMIT_PER_MINUTE: '0',
      DOWNLOAD_TOKEN_SECRET: '',
    };
    const config = new AppConfigService();
    assert.deepEqual(
      {
        port: config.port,
        cost: config.costLimitPerProject,
        rate: config.workflowRateLimitPerMinute,
        secret: config.downloadTokenSecret,
      },
      { port: 4100, cost: 9.5, rate: 0, secret: 'api-test-key' },
    );
  });

  it('falls back for invalid numeric values and creates a local download secret', () => {
    process.env = {
      ...originalEnv,
      API_PORT: 'invalid',
      API_KEY: '',
      COST_MAX_COST_PER_PROJECT: 'invalid',
      WORKFLOW_RATE_LIMIT_PER_MINUTE: '-1',
      DOWNLOAD_TOKEN_SECRET: '',
    };
    const config = new AppConfigService();
    assert.equal(config.port, 3001);
    assert.equal(config.costLimitPerProject, 5);
    assert.equal(config.workflowRateLimitPerMinute, 10);
    assert.match(config.downloadTokenSecret, /^[a-f0-9]{64}$/);
  });
});
