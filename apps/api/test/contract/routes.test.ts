import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../src/common/guards/public.decorator.js';
import { HealthController } from '../../src/health/health.controller.js';
import { ModelsController } from '../../src/modules/models/models.controller.js';
import { ProjectsController } from '../../src/modules/projects/projects.controller.js';
import { WorkflowController } from '../../src/modules/workflow/workflow.controller.js';
import { ConversationsController } from '../../src/modules/conversations/conversations.controller.js';
import { ArtifactsController } from '../../src/modules/artifacts/artifacts.controller.js';
import { ExportsController } from '../../src/modules/exports/exports.controller.js';
import { UsageController } from '../../src/modules/usage/usage.controller.js';

const controllers = [
  HealthController,
  ModelsController,
  ProjectsController,
  WorkflowController,
  ConversationsController,
  ArtifactsController,
  ExportsController,
  UsageController,
];

const expectedRoutes = [
  'GET /health',
  'GET /models',
  'GET /models/{provider_name}',
  'POST /projects',
  'GET /projects',
  'GET /projects/{project_id}',
  'DELETE /projects/{project_id}',
  'POST /projects/{project_id}/run',
  'GET /projects/{project_id}/workflow/status',
  'POST /projects/{project_id}/workflow/continue',
  'GET /projects/{project_id}/workflow/states',
  'GET /projects/{project_id}/workflow/executions',
  'GET /projects/{project_id}/workflow/executions/{execution_id}',
  'GET /projects/{project_id}/workflow/executions/{execution_id}/logs',
  'POST /projects/{project_id}/conversations',
  'POST /projects/{project_id}/conversations/{conversation_id}/messages',
  'GET /projects/{project_id}/conversations/{conversation_id}/messages',
  'GET /projects/{project_id}/artifacts',
  'GET /projects/{project_id}/artifacts/{artifact_id}',
  'GET /projects/{project_id}/artifacts/{artifact_id}/download',
  'POST /projects/{project_id}/export/prd',
  'GET /projects/{project_id}/export/{export_id}',
  'GET /projects/{project_id}/export/{export_id}/download',
  'GET /usage/tokens',
  'GET /projects/{project_id}/usage/logs',
  'GET /projects/{project_id}/usage/logs/{log_id}',
].sort();

const methodNames: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.DELETE]: 'DELETE',
};

function routeEntries(controller: Function): string[] {
  const prototype = controller.prototype;
  const prefix = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .flatMap((name) => {
      const handler = prototype[name];
      const method = methodNames[Reflect.getMetadata(METHOD_METADATA, handler)];
      if (!method) return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
      const route = `${method} /${[prefix, path].filter(Boolean).join('/')}`
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      return [route];
    })
    .map((route) => route.replace(/:([a-z_]+)/g, '{$1}'));
}

describe('API route contract', () => {
  it('keeps all 26 documented routes registered on controllers', () => {
    const actual = controllers.flatMap(routeEntries).sort();
    assert.deepEqual(actual, expectedRoutes);
  });

  it('keeps health and model routes public', () => {
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController.prototype.check), true);
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, ModelsController.prototype.list), true);
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, ModelsController.prototype.detail), true);
  });
});
