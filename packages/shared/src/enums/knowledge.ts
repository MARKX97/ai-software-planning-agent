export const KnowledgeSourceKind = {
  FILE: 'file',
  GITHUB_REPOSITORY: 'github_repository',
} as const;

export type KnowledgeSourceKind = (typeof KnowledgeSourceKind)[keyof typeof KnowledgeSourceKind];

export const KnowledgeStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  READY_WITH_WARNINGS: 'ready_with_warnings',
  FAILED: 'failed',
  DELETED: 'deleted',
} as const;

export type KnowledgeStatus = (typeof KnowledgeStatus)[keyof typeof KnowledgeStatus];
