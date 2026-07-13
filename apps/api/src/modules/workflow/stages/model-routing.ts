/**
 * Model routing configuration per `specs/model-routing.spec.md` §1-2.
 *
 * Maps each workflow stage to its provider name; maps each artifact type to
 * its provider name (used in `planning_generation`).
 *
 * @internal
 */
export const STAGE_PROVIDER: Record<string, string> = {
  requirement_analysis: 'deepseek',
  requirement_clarification: 'glm',
  multi_model_analysis: 'all', // special: calls all providers via callMulti
  requirement_synthesis: 'deepseek',
  feasibility_analysis: 'glm',
  risk_analysis: 'deepseek',
  mvp_compression: 'deepseek',
  platform_recommendation: 'glm',
  planning_generation: 'mixed', // special: per-artifact routing below
};

/** Per-stage timeout contract in milliseconds. */
export const STAGE_TIMEOUT_MS: Record<string, number> = {
  requirement_analysis: 60_000,
  requirement_clarification: 60_000,
  multi_model_analysis: 90_000,
  requirement_synthesis: 60_000,
  feasibility_analysis: 60_000,
  risk_analysis: 60_000,
  mvp_compression: 60_000,
  platform_recommendation: 60_000,
  planning_generation: 120_000,
};

/** Maps each artifact type to its provider name per spec §2. */
export const ARTIFACT_PROVIDER: Record<string, string> = {
  requirement_report: 'glm',
  feasibility_report: 'glm',
  risk_report: 'glm',
  mvp_plan: 'glm',
  platform_recommendation: 'glm',
  project_plan: 'glm',
  prd: 'deepseek',
  architecture: 'deepseek',
  frontend_spec: 'glm',
  backend_spec: 'glm',
  ai_coding_rules: 'glm',
};

/** Display name for each artifact type. */
export const ARTIFACT_DISPLAY_NAME: Record<string, string> = {
  requirement_report: '需求分析报告',
  feasibility_report: '可行性分析报告',
  risk_report: '风险分析报告',
  mvp_plan: 'MVP 范围',
  platform_recommendation: '平台推荐',
  project_plan: '项目计划',
  prd: 'PRD 产品需求文档',
  architecture: '架构设计文档',
  frontend_spec: '前端规格说明',
  backend_spec: '后端规格说明',
  ai_coding_rules: 'AI 编码规范',
};

/** Ordered list of artifact types produced by the planning_generation stage. */
export const ARTIFACT_TYPES = [
  'requirement_report',
  'feasibility_report',
  'risk_report',
  'mvp_plan',
  'platform_recommendation',
  'prd',
  'architecture',
  'frontend_spec',
  'backend_spec',
  'project_plan',
  'ai_coding_rules',
] as const;
