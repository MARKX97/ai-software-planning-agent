export type KnowledgeStatus =
  'pending' | 'processing' | 'ready' | 'ready_with_warnings' | 'failed' | 'deleted';

export interface KnowledgeSourceResponse {
  id: string;
  project_id: string;
  kind: 'file' | 'github_repository';
  name: string;
  mime_type?: string | null;
  source_uri?: string | null;
  content_hash: string;
  status: KnowledgeStatus;
  warning_count: number;
  error_code?: string | null;
  error_message?: string | null;
  active_revision?: number | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSourceListResponse {
  items: KnowledgeSourceResponse[];
  total: number;
}
