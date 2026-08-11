import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArtifactType } from '@ai-planning/database';
import { deriveRegenerationImpact } from '../../src/modules/workflow/artifact-generation/artifact-impact.js';
import {
  mergeRegenerationImpacts,
  retainFailedRegenerationTargets,
} from '../../src/modules/workflow/artifact-generation/artifact-regeneration-state.js';

const old = new Date('2026-08-01T00:00:00.000Z');
const current = new Date('2026-08-02T00:00:00.000Z');
const newer = new Date('2026-08-03T00:00:00.000Z');

describe('artifact regeneration impact', () => {
  it('propagates a new source from PRD and architecture to their dependents', () => {
    const impact = deriveRegenerationImpact(
      [artifact('prd'), artifact('architecture')],
      [{ id: 'source-new', createdAt: newer }],
      new Map(),
    );
    assert.deepEqual(impact, {
      affected_artifacts: [
        'prd',
        'architecture',
        'frontend_spec',
        'backend_spec',
        'project_plan',
        'ai_coding_rules',
      ],
      source_ids: ['source-new'],
    });
  });

  it('regenerates architecture dependents for a stale citation and returns null when unchanged', () => {
    const cited = artifact('architecture', [
      { sourceId: 'source-1', chunkId: 'chunk-1', contentHash: 'old-hash' },
    ]);
    const sources = [{ id: 'source-1', createdAt: old }];
    assert.deepEqual(deriveRegenerationImpact([artifact('prd'), cited], sources, new Map()), {
      affected_artifacts: [
        'architecture',
        'frontend_spec',
        'backend_spec',
        'project_plan',
        'ai_coding_rules',
      ],
      source_ids: ['source-1'],
    });
    assert.equal(
      deriveRegenerationImpact(
        [artifact('prd'), cited],
        sources,
        new Map([['chunk-1', 'old-hash']]),
      ),
      null,
    );
  });

  it('keeps failed incremental targets after successful targets change the derived impact', async () => {
    assert.deepEqual(
      mergeRegenerationImpacts(null, {
        affected_artifacts: ['backend_spec'],
        source_ids: ['source-1'],
      }),
      { affected_artifacts: ['backend_spec'], source_ids: ['source-1'] },
    );
    let saved: Record<string, unknown> | undefined;
    const db = {
      client: {
        workflowState: {
          findUnique: async () => ({
            data_json: {
              quality_report: { status: 'warning' },
              _regeneration: { affected_artifacts: ['prd'], source_ids: ['source-1'] },
            },
          }),
          update: async (input: { data: { data_json: Record<string, unknown> } }) => {
            saved = input.data.data_json;
          },
        },
      },
    };

    await retainFailedRegenerationTargets(db as never, 'project-1', ['backend_spec']);

    assert.deepEqual(saved?.['_regeneration'], {
      affected_artifacts: ['backend_spec'],
      source_ids: ['source-1'],
    });
    assert.deepEqual(saved?.['quality_report'], { status: 'warning' });
  });
});

function artifact(
  type: ArtifactType,
  citations: ReadonlyArray<{ sourceId: string; chunkId: string; contentHash: string }> = [],
) {
  return { type, createdAt: current, citations };
}
