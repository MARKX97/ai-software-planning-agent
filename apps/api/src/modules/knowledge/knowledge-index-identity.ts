import type { IndexIdentity } from './knowledge-index.store.js';

export interface IndexBeginInput {
  readonly projectId: string;
  readonly sourceId: string;
  readonly contentHash: string;
  readonly identity: IndexIdentity;
}

export function sameIndexIdentity(
  active: {
    content_hash: string;
    embedding_model: string | null;
    embedding_dimensions: number | null;
    indexer_version: string;
  },
  input: IndexBeginInput,
): boolean {
  return (
    active.content_hash === input.contentHash &&
    active.embedding_model === input.identity.model &&
    active.embedding_dimensions === input.identity.dimensions &&
    active.indexer_version === input.identity.version
  );
}
