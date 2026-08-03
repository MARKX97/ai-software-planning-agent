import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { ArtifactType } from '@ai-planning/database';
import {
  WorkflowStage,
  type LLMResponse,
  type MultiModelAnalysisResult,
  type StageResult,
  type WorkflowContext,
} from '@ai-planning/shared';
import { ConflictResolver } from '../../src/modules/workflow/synthesis/conflict-resolver.js';
import { ArtifactGenerator } from '../../src/modules/workflow/artifact-generation/artifact-generator.js';
import { ArtifactFileStore } from '../../src/modules/workflow/artifact-generation/artifact-file-store.js';
import { inspectArtifact } from '../../src/modules/workflow/artifact-generation/artifact-quality.js';
import { ARTIFACT_TYPES } from '../../src/modules/workflow/stages/model-routing.js';

describe('ConflictResolver', () => {
  it('extracts common points, conflicts, and unique insights', () => {
    const resolver = new ConflictResolver();
    const result = resolver.resolve({
      deepseek: analysis('deepseek', 'Auth', ['secure'], ['scope risk'], []),
      glm: analysis('glm', 'Auth', ['simple'], [], ['payment unknown']),
      minimax: analysis('minimax', 'Export', ['fast'], [], []),
    });

    assert.deepEqual(JSON.parse(result.commonPoints), ['Auth']);
    assert.equal(JSON.parse(result.conflicts).length, 2);
    assert.deepEqual(Object.keys(JSON.parse(result.uniqueInsights)).sort(), [
      'deepseek',
      'glm',
      'minimax',
    ]);
  });
});

describe('ArtifactGenerator', () => {
  it('routes artifacts by type and keeps successful artifacts when one fails', async () => {
    const calls: Array<{ provider: string; prompt: string }> = [];
    const saved: Array<{ type: ArtifactType; content: string }> = [];
    const orchestrator = mockOrchestrator(calls, 'backend_spec');
    const dataDir = await mkdtemp(join(tmpdir(), 'artifact-generator-'));
    try {
      const store = new ArtifactFileStore(mockDb(saved) as never, dataDir);
      const generator = new ArtifactGenerator(orchestrator, store);
      const result = await generator.generateAll(context());
      assert.equal(result.successes.length, ARTIFACT_TYPES.length - 1);
      assert.equal(result.failures.length, 1);
      assert.equal(result.failures[0]?.type, 'backend_spec');
      assert.equal(saved.length, ARTIFACT_TYPES.length - 1);
      assert.equal(result.qualityReport.status, 'warning');
      assert.equal(result.qualityReport.generated_artifacts, ARTIFACT_TYPES.length - 1);
      assert.equal(calls.find((c) => hasArtifactType(c.prompt, 'prd'))?.provider, 'deepseek');
      assert.equal(
        calls.find((c) => hasArtifactType(c.prompt, 'architecture'))?.provider,
        'deepseek',
      );
      assert.equal(
        calls.find((c) => hasArtifactType(c.prompt, 'requirement_report'))?.provider,
        'glm',
      );
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it('revises a mechanically invalid artifact at most once', async () => {
    let prdCalls = 0;
    const calls: Array<{ provider: string; prompt: string }> = [];
    const saved: Array<{ type: ArtifactType; content: string }> = [];
    const orchestrator = {
      callSingle: async (provider: string, prompt: string): Promise<LLMResponse> => {
        calls.push({ provider, prompt });
        if (hasArtifactType(prompt, 'prd') && prdCalls++ === 0) {
          return response(provider, prompt, 'too short');
        }
        return response(provider, prompt);
      },
    } as unknown as LlmOrchestratorService;
    const dataDir = await mkdtemp(join(tmpdir(), 'artifact-revision-'));
    try {
      const generator = new ArtifactGenerator(
        orchestrator,
        new ArtifactFileStore(mockDb(saved) as never, dataDir),
      );
      const result = await generator.generateAll(context());

      assert.equal(calls.length, ARTIFACT_TYPES.length + 1);
      assert.deepEqual(result.qualityReport.revised_artifacts, ['prd']);
      assert.equal(result.qualityReport.status, 'passed');
      assert.equal(result.successes.find((item) => item.type === 'prd')?.calls.length, 2);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it('persists only valid citation markers and rejects hallucinated keys', async () => {
    const saved: SavedArtifact[] = [];
    const orchestrator = {
      callSingle: async (provider: string, prompt: string): Promise<LLMResponse> => {
        const marker = prompt.includes('[S1]') ? ' [S1]' : '';
        return response(
          provider,
          prompt,
          `# Cited artifact\n\n${'Detailed evidence-backed content. '.repeat(6)}${marker}`,
        );
      },
    } as unknown as LlmOrchestratorService;
    const dataDir = await mkdtemp(join(tmpdir(), 'artifact-citation-'));
    try {
      const generator = new ArtifactGenerator(
        orchestrator,
        new ArtifactFileStore(mockDb(saved) as never, dataDir),
      );
      const result = await generator.generateAll(context(), [evidence()]);
      const prd = result.successes.find((item) => item.type === 'prd');
      assert.deepEqual(
        prd?.citations.map((item) => item.citationKey),
        ['S1'],
      );
      assert.equal(saved.find((item) => item.type === 'prd')?.citationCount, 1);
      assert.deepEqual(inspectArtifact('# Valid\n\n' + 'x'.repeat(130) + ' [S9]', ['S1']), [
        'citation_consistency',
      ]);
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});

function analysis(
  model: string,
  title: string,
  strengths: string[],
  weaknesses: string[],
  unknowns: string[],
): MultiModelAnalysisResult {
  return {
    model_name: model,
    requirement_points: [
      {
        id: `${model}-${title}`,
        title,
        description: title,
        priority: 'P0',
        category: 'functional',
      },
    ],
    strengths,
    weaknesses,
    unknowns,
    recommendation: `${model} recommendation`,
  };
}

function hasArtifactType(prompt: string, type: ArtifactType): boolean {
  return prompt.includes(`<untrusted-context name="artifactType">\n${type}\n`);
}

function mockOrchestrator(
  calls: Array<{ provider: string; prompt: string }>,
  failingType: ArtifactType,
): LlmOrchestratorService {
  return {
    callSingle: async (provider: string, prompt: string): Promise<LLMResponse> => {
      calls.push({ provider, prompt });
      if (prompt.includes(failingType)) throw new Error('provider failed');
      return response(provider, prompt);
    },
  } as unknown as LlmOrchestratorService;
}

function response(provider: string, prompt: string, content?: string): LLMResponse {
  return {
    provider,
    model: provider,
    content:
      content ??
      `# ${prompt.slice(0, 24)}\n\n## Goal\n\n${'Detailed, actionable planning content. '.repeat(6)}`,
    structuredOutput: null,
    usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
    cost: { inputCost: 0, outputCost: 0, cachedInputCost: 0, totalCost: 0 },
    latencyMs: 1,
    retries: 0,
    timestamp: new Date(0).toISOString(),
  };
}

interface SavedArtifact {
  type: ArtifactType;
  content: string;
  citationCount?: number;
}

function mockDb(saved: SavedArtifact[]): unknown {
  return {
    client: {
      artifact: {
        updateMany: async () => ({ count: 0 }),
        create: async (args: {
          data: {
            type: ArtifactType;
            content: string;
            citations?: { create: unknown[] };
          };
        }) => {
          saved.push({
            type: args.data.type,
            content: args.data.content,
            citationCount: args.data.citations?.create.length,
          });
          return { id: `${args.data.type}-id`, ...args.data };
        },
        findFirst: async () => null,
      },
      tokenUsage: { upsert: async () => undefined },
    },
  };
}

function evidence() {
  return {
    sourceId: '550e8400-e29b-41d4-a716-446655440000',
    documentId: '550e8400-e29b-41d4-a716-446655440001',
    chunkId: '550e8400-e29b-41d4-a716-446655440002',
    title: 'Architecture',
    locator: 'guide.md:L1-L4',
    excerpt: 'Use PostgreSQL 16.',
    contentHash: 'a'.repeat(64),
  };
}

function context(): WorkflowContext {
  return {
    projectId: 'project-1',
    executionId: 'execution-1',
    originalIdea: 'Build planning agent',
    conversationHistory: '',
    confirmedDecisions: [],
    clarificationRound: 0,
    resultsByStage: {
      [WorkflowStage.REQUIREMENT_SYNTHESIS]: {
        stage: WorkflowStage.REQUIREMENT_SYNTHESIS,
        structuredOutput: { executive_summary: 'summary' },
        content: 'summary',
      },
    } as unknown as Record<WorkflowStage, StageResult>,
  };
}
