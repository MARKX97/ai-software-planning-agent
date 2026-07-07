import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  requirementAnalysisSchema,
  multiModelAnalysisSchema,
  synthesizedRequirementSchema,
  feasibilityAssessmentSchema,
  riskAnalysisSchema,
  mvpPlanSchema,
  platformRecommendationSchema,
  projectPlanSchema,
} from '../src/schemas/llm/index.js';

const validRequirementPoint = {
  id: 'R1',
  title: 'Login',
  description: 'Users can log in',
  priority: 'high',
  category: 'auth',
};

describe('llm schemas', () => {
  it('accepts valid requirement-analysis payload', () => {
    const r = requirementAnalysisSchema.safeParse({
      project_summary: 'A planning agent',
      target_users: ['pm'],
      core_problems: ['no plan'],
      requirement_points: [validRequirementPoint],
      assumptions: ['budget ok'],
      clarification_questions: ['who?'],
    });
    assert.ok(r.success);
  });

  it('rejects requirement-analysis with missing required field', () => {
    const r = requirementAnalysisSchema.safeParse({
      project_summary: 'x',
      target_users: [],
      core_problems: [],
      requirement_points: [],
      assumptions: [],
    });
    assert.equal(r.success, false);
  });

  it('rejects invalid priority enum value', () => {
    const r = requirementAnalysisSchema.safeParse({
      project_summary: 'x',
      target_users: [],
      core_problems: [],
      requirement_points: [{ ...validRequirementPoint, priority: 'urgent' }],
      assumptions: [],
      clarification_questions: [],
    });
    assert.equal(r.success, false);
  });

  it('accepts valid multi-model-analysis payload', () => {
    const r = multiModelAnalysisSchema.safeParse({
      model_name: 'deepseek',
      requirement_points: [validRequirementPoint],
      strengths: ['fast'],
      weaknesses: ['shallow'],
      unknowns: ['scope'],
      recommendation: 'go',
    });
    assert.ok(r.success);
  });

  it('accepts valid synthesized-requirement payload', () => {
    const r = synthesizedRequirementSchema.safeParse({
      project_name: 'app',
      executive_summary: 'summary',
      user_personas: ['pm'],
      functional_requirements: [validRequirementPoint],
      non_functional_requirements: [],
      conflicts_resolved: [{ topic: 'x', positions: ['a', 'b'] }],
      scope_boundary: 'within app',
    });
    assert.ok(r.success);
  });

  it('accepts valid feasibility-assessment payload', () => {
    const r = feasibilityAssessmentSchema.safeParse({
      technical_feasibility: 'high',
      technical_risks: ['risk'],
      resource_estimation: '2 devs',
      timeline_estimation: '4 weeks',
      dependencies: ['db'],
      alternative_approaches: ['alt'],
    });
    assert.ok(r.success);
  });

  it('accepts valid risk-analysis payload', () => {
    const r = riskAnalysisSchema.safeParse({
      risks: [
        {
          id: 'RISK-1',
          category: 'tech',
          description: 'db down',
          probability: 'low',
          impact: 'high',
          mitigation: 'replica',
          contingency: 'fallback',
        },
      ],
      overall_risk_level: 'medium',
      critical_risks: ['RISK-1'],
    });
    assert.ok(r.success);
  });

  it('accepts valid mvp-plan payload', () => {
    const r = mvpPlanSchema.safeParse({
      mvp_scope: ['login'],
      deferred_scope: ['billing'],
      mvp_goal: 'login works',
      success_metrics: ['retention'],
      timeline: '2 weeks',
      milestones: ['m1'],
    });
    assert.ok(r.success);
  });

  it('accepts valid platform-recommendation payload', () => {
    const r = platformRecommendationSchema.safeParse({
      recommended_platform: 'Next.js',
      tech_stack: ['next', 'nest'],
      rationale: 'fast',
      alternatives: ['remix'],
      trade_offs: 'less',
    });
    assert.ok(r.success);
  });

  it('accepts valid project-plan payload', () => {
    const r = projectPlanSchema.safeParse({
      phases: ['mvp'],
      architecture_overview: 'monorepo',
      component_tree: 'tree',
      data_model: 'prisma',
      api_endpoints: ['/api/v1'],
      development_guide: 'guide',
      ai_coding_prompt: 'prompt',
    });
    assert.ok(r.success);
  });
});
