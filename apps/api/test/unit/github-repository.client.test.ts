import assert from 'node:assert/strict';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import tar from 'tar-stream';
import { GitHubRepositoryClient } from '../../src/modules/knowledge/github-repository.client.js';

const commit = 'a'.repeat(40);

@Module({ providers: [GitHubRepositoryClient] })
class RepositoryClientTestModule {}

describe('GitHubRepositoryClient', () => {
  it('starts through Nest without requiring a fetch provider', async () => {
    const app = await NestFactory.createApplicationContext(RepositoryClientTestModule, {
      logger: false,
    });
    assert.ok(app.get(GitHubRepositoryClient));
    await app.close();
  });

  it('imports only safe text files from the immutable archive snapshot', async () => {
    const archive = await tarball([
      ['sample-main/README.md', '# Readme\nusable text'],
      ['sample-main/src/main.ts', 'export const answer = 42;'],
      ['sample-main/.git/config', 'ignored'],
      ['sample-main/package-lock.json', 'ignored'],
      ['sample-main/secret.txt', 'API_KEY=0123456789abcdef'],
      ['sample-main/image.png', 'ignored'],
    ]);
    const client = new GitHubRepositoryClient(async (url) => {
      if (url.endsWith('/repos/acme/sample')) return Response.json({ default_branch: 'main' });
      if (url.endsWith('/commits/main')) return Response.json({ sha: commit });
      if (url.endsWith(`/tar.gz/${commit}`)) return new Response(archive);
      return new Response(null, { status: 404 });
    });

    const snapshot = await client.import('https://github.com/acme/sample');
    assert.equal(snapshot.commit, commit);
    assert.deepEqual(
      snapshot.files.map((file) => file.path),
      ['README.md', 'src/main.ts'],
    );
  });

  it('rejects non-GitHub repository URLs before making a request', async () => {
    const client = new GitHubRepositoryClient(async () => assert.fail('fetch must not run'));
    await assert.rejects(() => client.import('https://github.com/acme/sample/issues'));
  });
});

async function tarball(entries: readonly [string, string][]): Promise<Buffer> {
  const pack = tar.pack();
  const gzip = createGzip();
  const chunks: Buffer[] = [];
  pack.pipe(gzip).on('data', (chunk: Buffer) => chunks.push(chunk));
  entries.forEach(([name, content]) => pack.entry({ name }, content));
  pack.finalize();
  await once(gzip, 'end');
  return Buffer.concat(chunks);
}
