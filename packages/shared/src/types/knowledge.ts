import type { z } from 'zod';
import type {
  artifactCitationSchema,
  evidenceCitationSchema,
  knowledgeSearchRequestSchema,
  knowledgeSearchResponseSchema,
  knowledgeSourceSchema,
} from '../schemas/knowledge.schema.js';

export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeSearchRequest = z.infer<typeof knowledgeSearchRequestSchema>;
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
export type ArtifactCitation = z.infer<typeof artifactCitationSchema>;
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;
