import { z } from 'zod';
import { KnowledgeSourceKind, KnowledgeStatus } from '../enums/knowledge.js';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const knowledgeSourceKindSchema = z.enum([
  KnowledgeSourceKind.FILE,
  KnowledgeSourceKind.GITHUB_REPOSITORY,
]);

export const knowledgeStatusSchema = z.enum([
  KnowledgeStatus.PENDING,
  KnowledgeStatus.PROCESSING,
  KnowledgeStatus.READY,
  KnowledgeStatus.READY_WITH_WARNINGS,
  KnowledgeStatus.FAILED,
  KnowledgeStatus.DELETED,
]);

export const knowledgeSourceSchema = z
  .object({
    id: z.string().uuid(),
    project_id: z.string().uuid(),
    kind: knowledgeSourceKindSchema,
    name: z.string().trim().min(1).max(255),
    mime_type: z.string().nullable().optional(),
    source_uri: z.string().nullable().optional(),
    content_hash: sha256Schema,
    status: knowledgeStatusSchema,
    warning_count: z.number().int().nonnegative(),
    error_code: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
    active_revision: z.number().int().positive().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

export const knowledgeSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    source_ids: z.array(z.string().uuid()).max(50).optional(),
    top_k: z.number().int().min(1).max(8).default(8),
  })
  .strict();

export const evidenceCitationSchema = z
  .object({
    sourceId: z.string().uuid(),
    documentId: z.string().uuid(),
    chunkId: z.string().uuid(),
    title: z.string().trim().min(1).max(255),
    locator: z.string().trim().min(1),
    excerpt: z.string().trim().min(1).max(2000),
    contentHash: sha256Schema,
  })
  .strict();

export const artifactCitationSchema = evidenceCitationSchema
  .extend({ citationKey: z.string().regex(/^S[1-8]$/) })
  .strict();

export const knowledgeSearchResponseSchema = z
  .object({
    items: z.array(evidenceCitationSchema).max(8),
    insufficient_evidence: z.boolean(),
  })
  .strict();
