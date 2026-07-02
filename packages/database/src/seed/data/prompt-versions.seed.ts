import type { Prisma } from '../../generated/prisma/client.js';

/** Seed data for prompt_versions (Phase 2: minimal reference rows). */
export const promptVersionSeed: Prisma.PromptVersionCreateInput[] = [
  {
    prompt_name: 'requirement_analysis',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-requirement-analysis-v1',
    description: 'Initial requirement analysis prompt (MVP placeholder).',
  },
  {
    prompt_name: 'multi_model_analysis',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-multi-model-v1',
    description: 'Initial multi-model analysis prompt (MVP placeholder).',
  },
  {
    prompt_name: 'requirement_synthesis',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-synthesis-v1',
    description: 'Initial requirement synthesis prompt (MVP placeholder).',
  },
  {
    prompt_name: 'feasibility_analysis',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-feasibility-v1',
    description: 'Initial feasibility analysis prompt (MVP placeholder).',
  },
  {
    prompt_name: 'risk_analysis',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-risk-v1',
    description: 'Initial risk analysis prompt (MVP placeholder).',
  },
  {
    prompt_name: 'mvp_compression',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-mvp-v1',
    description: 'Initial MVP compression prompt (MVP placeholder).',
  },
  {
    prompt_name: 'platform_recommendation',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-platform-v1',
    description: 'Initial platform recommendation prompt (MVP placeholder).',
  },
  {
    prompt_name: 'planning_generation',
    version: '1.0.0',
    content_hash: 'sha256-placeholder-planning-v1',
    description: 'Initial planning generation prompt (MVP placeholder).',
  },
];