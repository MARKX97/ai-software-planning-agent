import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { extractRepositoryFiles } from './github-archive.js';

export const GITHUB_FETCH = Symbol('GITHUB_FETCH');

export interface RepositoryFile {
  readonly path: string;
  readonly content: string;
}

export interface RepositorySnapshot {
  readonly name: string;
  readonly sourceUri: string;
  readonly commit: string;
  readonly files: readonly RepositoryFile[];
}

@Injectable()
export class GitHubRepositoryClient {
  constructor(@Optional() @Inject(GITHUB_FETCH) private readonly fetcher: typeof fetch = fetch) {}

  async import(repositoryUrl: string): Promise<RepositorySnapshot> {
    const identity = parseRepositoryUrl(repositoryUrl);
    const metadata = await this.json<{ default_branch?: string }>(
      `https://api.github.com/repos/${identity.owner}/${identity.repository}`,
    );
    if (!metadata.default_branch) throw unavailable();
    const commit = await this.json<{ sha?: string }>(
      `https://api.github.com/repos/${identity.owner}/${identity.repository}/commits/${encodeURIComponent(metadata.default_branch)}`,
    );
    if (!commit.sha || !/^[a-f0-9]{40}$/i.test(commit.sha)) throw unavailable();
    return this.snapshot(identity, commit.sha);
  }

  async reimport(repositoryUrl: string, commit: string): Promise<RepositorySnapshot> {
    if (!/^[a-f0-9]{40}$/i.test(commit)) throw invalidRepository();
    return this.snapshot(parseRepositoryUrl(repositoryUrl), commit);
  }

  private async snapshot(
    identity: RepositoryIdentity,
    commit: string,
  ): Promise<RepositorySnapshot> {
    const archive = await this.fetchArchive(identity, commit);
    const body = archive.body;
    if (!body) throw unavailable();
    return {
      name: `${identity.owner}/${identity.repository}`,
      sourceUri: `https://github.com/${identity.owner}/${identity.repository}`,
      commit: commit.toLowerCase(),
      files: await extractRepositoryFiles(body),
    };
  }

  private async json<T>(url: string): Promise<T> {
    const response = await this.request(url);
    if (response.status === 404)
      throw AppException.notFound(
        ErrorCode.KNOWLEDGE_SOURCE_NOT_FOUND,
        'Public repository not found',
      );
    if (!response.ok) throw unavailable();
    try {
      return (await response.json()) as T;
    } catch {
      throw unavailable();
    }
  }

  private async fetchArchive(identity: RepositoryIdentity, commit: string): Promise<Response> {
    const response = await this.request(
      `https://codeload.github.com/${identity.owner}/${identity.repository}/tar.gz/${commit}`,
    );
    if (!response.ok || !response.body) throw unavailable();
    return response;
  }

  private async request(url: string): Promise<Response> {
    try {
      return await this.fetcher(url, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'ai-planning-agent' },
        redirect: 'manual',
      });
    } catch {
      throw unavailable();
    }
  }
}

interface RepositoryIdentity {
  readonly owner: string;
  readonly repository: string;
}

function parseRepositoryUrl(value: string): RepositoryIdentity {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidRepository();
  }
  const segments = url.pathname.split('/').filter(Boolean);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    segments.length !== 2
  ) {
    throw invalidRepository();
  }
  const [owner, repository] = segments;
  if (
    !owner ||
    !repository ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repository)
  ) {
    throw invalidRepository();
  }
  return { owner, repository };
}

function invalidRepository(): AppException {
  return AppException.badRequest(ErrorCode.INVALID_INPUT, 'Repository URL or content is invalid');
}

function unavailable(): AppException {
  return AppException.internal(
    'Public repository is temporarily unavailable',
    ErrorCode.KNOWLEDGE_UNAVAILABLE,
  );
}
