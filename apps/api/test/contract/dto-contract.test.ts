import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type ArgumentMetadata } from '@nestjs/common';
import { AppException } from '../../src/common/exception/app-exception.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { HttpExceptionFilter } from '../../src/common/exception/http-exception.filter.js';
import { AuthGuard } from '../../src/common/guards/auth.guard.js';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
} from '../../src/modules/projects/projects.dto.js';
import {
  sendMessageSchema,
  listMessagesQuerySchema,
} from '../../src/modules/conversations/conversations.dto.js';
import {
  continueWorkflowSchema,
  listExecutionsQuerySchema,
} from '../../src/modules/workflow/workflow.dto.js';
import { listArtifactsQuerySchema } from '../../src/modules/artifacts/artifacts.dto.js';
import { exportRequestSchema } from '../../src/modules/exports/exports.dto.js';
import { tokenUsageQuerySchema, listLogsQuerySchema } from '../../src/modules/usage/usage.dto.js';

const body: ArgumentMetadata = { type: 'body', metatype: Object, data: undefined };
const query: ArgumentMetadata = { type: 'query', metatype: Object, data: undefined };

describe('API request contracts', () => {
  it('accepts valid payloads and applies documented defaults', () => {
    assert.deepEqual(createProjectSchema.parse({ name: 'A', original_idea: 'B' }), {
      name: 'A',
      original_idea: 'B',
    });
    assert.deepEqual(listProjectsQuerySchema.parse({}), { offset: 0, limit: 20 });
    assert.deepEqual(listMessagesQuerySchema.parse({}), { offset: 0, limit: 50 });
    assert.deepEqual(listExecutionsQuerySchema.parse({}), { offset: 0, limit: 20 });
    assert.deepEqual(listLogsQuerySchema.parse({}), { offset: 0, limit: 50 });
    assert.deepEqual(exportRequestSchema.parse({}), { format: 'markdown', artifact_types: [] });
    assert.deepEqual(listArtifactsQuerySchema.parse({}), {});
  });

  it('rejects invalid body, path-dependent and pagination values', () => {
    assert.equal(createProjectSchema.safeParse({ name: '', original_idea: 'idea' }).success, false);
    assert.equal(sendMessageSchema.safeParse({ content: '' }).success, false);
    assert.equal(
      continueWorkflowSchema.safeParse({ conversation_id: 'bad', message: 'reply' }).success,
      false,
    );
    assert.equal(tokenUsageQuerySchema.safeParse({ project_id: 'bad' }).success, false);
    assert.equal(listProjectsQuerySchema.safeParse({ limit: 101 }).success, false);
    assert.equal(listArtifactsQuerySchema.safeParse({ type: 'unknown' }).success, false);
  });

  it('normalizes validation failures through the project pipe', () => {
    const pipe = new ZodValidationPipe(createProjectSchema);
    assert.throws(
      () => pipe.transform({ name: '' }, body),
      (error: unknown) => {
        return error instanceof AppException && error.code === ErrorCode.INVALID_INPUT;
      },
    );
    const queryPipe = new ZodValidationPipe(listProjectsQuerySchema);
    assert.deepEqual(queryPipe.transform({ offset: '2' }, query), { offset: 2, limit: 20 });
  });
});

describe('API error and auth contracts', () => {
  it('emits the unified error envelope', () => {
    let status = 0;
    let payload: unknown;
    const response = {
      status(code: number) {
        status = code;
        return {
          json(value: unknown) {
            payload = value;
          },
        };
      },
    };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new HttpExceptionFilter().catch(
      AppException.conflict(ErrorCode.WORKFLOW_ALREADY_RUNNING, 'busy'),
      host,
    );
    assert.equal(status, 409);
    assert.deepEqual(payload, {
      error: { code: ErrorCode.WORKFLOW_ALREADY_RUNNING, message: 'busy' },
    });
  });

  it('enforces bearer auth while allowing an empty API key configuration', () => {
    const reflector = { getAllAndOverride: () => false } as never;
    const config = { apiKey: 'secret' } as never;
    const guard = new AuthGuard(reflector, config);
    const context = (authorization?: string) =>
      ({
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
        switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
      }) as never;
    assert.throws(
      () => guard.canActivate(context()),
      (error: unknown) => error instanceof AppException && error.code === ErrorCode.UNAUTHORIZED,
    );
    assert.equal(guard.canActivate(context('Bearer secret')), true);
    assert.throws(
      () => guard.canActivate(context('Bearer wrong')),
      (error: unknown) => error instanceof AppException && error.code === ErrorCode.FORBIDDEN,
    );
    assert.equal(new AuthGuard(reflector, { apiKey: '' } as never).canActivate(context()), true);
  });
});
