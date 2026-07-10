import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderPrompt } from '../../src/prompts/prompt-template.js';
import { CLARIFICATION_PROMPT } from '../../src/prompts/clarification.prompt.js';
import { FEASIBILITY_ANALYSIS_PROMPT } from '../../src/prompts/feasibility-analysis.prompt.js';
import { MULTI_MODEL_ANALYSIS_PROMPT } from '../../src/prompts/multi-model-analysis.prompt.js';
import { MVP_COMPRESSION_PROMPT } from '../../src/prompts/mvp-compression.prompt.js';
import { PLANNING_GENERATION_PROMPT } from '../../src/prompts/planning-generation.prompt.js';
import { PLATFORM_RECOMMENDATION_PROMPT } from '../../src/prompts/platform-recommendation.prompt.js';
import { REQUIREMENT_ANALYSIS_PROMPT } from '../../src/prompts/requirement-analysis.prompt.js';
import { RISK_ANALYSIS_PROMPT } from '../../src/prompts/risk-analysis.prompt.js';
import { SYNTHESIS_PROMPT } from '../../src/prompts/synthesis.prompt.js';

const cases = [
  [REQUIREMENT_ANALYSIS_PROMPT, { idea: 'idea', conversationHistory: 'history' }],
  [CLARIFICATION_PROMPT, { questions: 'questions', conversationHistory: 'history' }],
  [MULTI_MODEL_ANALYSIS_PROMPT, { requirement: 'requirement' }],
  [
    SYNTHESIS_PROMPT,
    {
      originalIdea: 'idea',
      commonPoints: 'common',
      conflicts: 'conflicts',
      uniqueInsights: 'unique',
    },
  ],
  [FEASIBILITY_ANALYSIS_PROMPT, { requirement: 'requirement' }],
  [RISK_ANALYSIS_PROMPT, { requirement: 'requirement', feasibility: 'feasibility' }],
  [
    MVP_COMPRESSION_PROMPT,
    { requirement: 'requirement', feasibility: 'feasibility', risks: 'risks' },
  ],
  [PLATFORM_RECOMMENDATION_PROMPT, { requirement: 'requirement', mvp: 'mvp' }],
  [PLANNING_GENERATION_PROMPT, { artifactType: 'prd', context: 'context' }],
] as const;

describe('prompt regression', () => {
  it('renders every known template without unresolved variables', () => {
    for (const [template, vars] of cases) {
      const rendered = renderPrompt(template, vars);
      assert.doesNotMatch(rendered, /\{\{\w+\}\}/);
      if (template !== PLANNING_GENERATION_PROMPT) {
        assert.match(rendered, /Return ONLY valid JSON/);
      }
      assert.ok(rendered.length < 8_000);
    }
  });

  it('preserves unknown variables for explicit caller diagnosis', () => {
    assert.equal(renderPrompt('{{known}} {{missing}}', { known: 'value' }), 'value {{missing}}');
  });
});
