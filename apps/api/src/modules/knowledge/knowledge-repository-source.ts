import type { PrismaService } from '../../database/database.module.js';
import type { RepositorySnapshot } from './github-repository.client.js';
import type { SourceWithActiveRevision } from './knowledge.dto.js';

export async function createRepositorySource(
  db: PrismaService,
  input: { projectId: string; snapshot: RepositorySnapshot; contentHash: string },
): Promise<SourceWithActiveRevision> {
  const row = await db.client.knowledgeSource.create({
    data: {
      project_id: input.projectId,
      kind: 'github_repository',
      name: input.snapshot.name,
      source_uri: input.snapshot.sourceUri,
      repository_commit: input.snapshot.commit,
      content_hash: input.contentHash,
      status: 'pending',
      updated_at: new Date(),
    },
  });
  return { ...row, revisions: [] };
}
