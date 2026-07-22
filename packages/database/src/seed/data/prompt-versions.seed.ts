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
  {
    prompt_name: 'requirement_analysis',
    version: '2.0.0',
    content_hash: '425067f05463d08c2ad979aa077743a5367fc9764adea368279000b1eadcb6bc',
    description: 'V2 source SHA-256 for requirement analysis.',
  },
  {
    prompt_name: 'requirement_clarification',
    version: '2.0.0',
    content_hash: '4de0dc3cd592db4cec660bceb2f22bf2960b45e0863e94567c6bcf148207626a',
    description: 'V2 source SHA-256 for requirement clarification.',
  },
  {
    prompt_name: 'checkpoint_discussion',
    version: '2.0.0',
    content_hash: '9b8f59bafac07d8d83758f1bb3abf6eae3a2ac8a8bc56ffde3b5766e2a4d8caf',
    description: 'V2 source SHA-256 for checkpoint discussion.',
  },
  {
    prompt_name: 'multi_model_analysis',
    version: '2.0.0',
    content_hash: 'b085750e88c061cb1c043443804e930ed7af70950aad15242ea13bfb68e332e8',
    description: 'V2 source SHA-256 for multi-model analysis.',
  },
  {
    prompt_name: 'requirement_synthesis',
    version: '2.0.0',
    content_hash: '0652de7a4c55788adb43dbd9dc4b46520b7b9b6557a900f556904a30c86bbb7c',
    description: 'V2 source SHA-256 for requirement synthesis.',
  },
  {
    prompt_name: 'feasibility_analysis',
    version: '2.0.0',
    content_hash: '6ccde004c59b1fd61c7be4b4a74074ef1a4e1783828d422ab0a4b6b53756a09a',
    description: 'V2 source SHA-256 for feasibility analysis.',
  },
  {
    prompt_name: 'risk_analysis',
    version: '2.0.0',
    content_hash: 'df6076d065a7cf240c40ed6318f237dcb42f118cc0dc3581d247d8883da46d7c',
    description: 'V2 source SHA-256 for risk analysis.',
  },
  {
    prompt_name: 'mvp_compression',
    version: '2.0.0',
    content_hash: '9923ee5351bb627e29ee0b5cc13f512e2e042024101730e0748882d2c0d52a56',
    description: 'V2 source SHA-256 for MVP compression.',
  },
  {
    prompt_name: 'platform_recommendation',
    version: '2.0.0',
    content_hash: 'a7fcda8837efd74d74e2035a4ab7254a4067b906ea53b9e5edb9e753a9d4a010',
    description: 'V2 source SHA-256 for platform recommendation.',
  },
  {
    prompt_name: 'planning_generation',
    version: '2.0.0',
    content_hash: 'b3ccac54ff88f6fc380446ee5578f70aa901306b81fba25864982c9545a104d4',
    description: 'V2 source SHA-256 for planning generation quality rules.',
  },
];
