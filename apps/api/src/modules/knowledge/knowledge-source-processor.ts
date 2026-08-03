import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GitHubRepositoryClient, type RepositorySnapshot } from './github-repository.client.js';
import { KnowledgeIndexerService } from './knowledge-indexer.service.js';
import type { UploadedKnowledgeFile } from './knowledge-parser.js';

@Injectable()
export class KnowledgeSourceProcessor {
  constructor(
    private readonly indexer: KnowledgeIndexerService,
    private readonly repositories: GitHubRepositoryClient,
  ) {}

  parse(file: UploadedKnowledgeFile) {
    return this.indexer.parse(file);
  }

  index(
    projectId: string,
    sourceId: string,
    document: Awaited<ReturnType<KnowledgeIndexerService['parse']>>,
  ) {
    return this.indexer.index(projectId, sourceId, document);
  }

  importRepository(url: string) {
    return this.repositories.import(url);
  }

  reimportRepository(url: string, commit: string) {
    return this.repositories.reimport(url, commit);
  }

  async indexRepository(projectId: string, sourceId: string, snapshot: RepositorySnapshot) {
    const documents = await Promise.all(
      snapshot.files.map((file) =>
        this.indexer.parseRepositoryFile(file.path, file.content, snapshot.commit),
      ),
    );
    return this.indexer.indexMany({
      projectId,
      sourceId,
      documents,
      contentHash: repositorySnapshotHash(snapshot),
    });
  }
}

export function repositorySnapshotHash(snapshot: RepositorySnapshot): string {
  const digest = createHash('sha256').update(snapshot.commit);
  snapshot.files.forEach((file) => digest.update(`\0${file.path}\0`).update(file.content));
  return digest.digest('hex');
}
