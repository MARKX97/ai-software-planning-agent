import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import tar from 'tar-stream';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import type { RepositoryFile } from './github-repository.client.js';

const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 60 * 1024 * 1024;
const MAX_TEXT_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2_000;
const BLOCKED_DIRECTORIES = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'target',
  'vendor',
]);
const LOCK_FILES = new Set([
  'bun.lockb',
  'cargo.lock',
  'composer.lock',
  'go.sum',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);
const TEXT_EXTENSIONS = new Set([
  '.c',
  '.cs',
  '.css',
  '.go',
  '.graphql',
  '.h',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.kt',
  '.md',
  '.mjs',
  '.php',
  '.proto',
  '.py',
  '.rb',
  '.rs',
  '.scala',
  '.sh',
  '.sql',
  '.svelte',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.vue',
  '.yaml',
  '.yml',
]);

export async function extractRepositoryFiles(
  body: ReadableStream<Uint8Array>,
): Promise<RepositoryFile[]> {
  const files: RepositoryFile[] = [];
  const extractor = tar.extract();
  let textBytes = 0;
  extractor.on('entry', (header, stream, next) => {
    const path = archivePath(header.name);
    if (header.type !== 'file' || !path || !isIndexablePath(path)) {
      stream.resume();
      stream.on('end', next);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (textBytes + size > MAX_TEXT_BYTES)
        stream.destroy(new Error('indexed text limit exceeded'));
      else chunks.push(chunk);
    });
    stream.once('error', next);
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (!isText(buffer) || hasLikelySecret(buffer)) return next();
      textBytes += buffer.byteLength;
      files.push({ path, content: buffer.toString('utf8') });
      if (files.length > MAX_FILES) return next(new Error('file limit exceeded'));
      next();
    });
  });
  try {
    await pipeline(
      Readable.fromWeb(body),
      byteLimit(MAX_DOWNLOAD_BYTES),
      createGunzip(),
      byteLimit(MAX_ARCHIVE_BYTES),
      extractor,
    );
  } catch {
    throw invalidArchive();
  }
  if (files.length === 0) throw invalidArchive();
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function archivePath(value: string): string | null {
  const relative = value.split('/').slice(1);
  if (!relative.length || relative.some((part) => !part || part === '.' || part === '..'))
    return null;
  return relative.join('/');
}

function isIndexablePath(path: string): boolean {
  const parts = path.toLowerCase().split('/');
  const filename = parts.at(-1);
  return (
    !!filename &&
    !parts.some((part) => BLOCKED_DIRECTORIES.has(part)) &&
    !LOCK_FILES.has(filename) &&
    TEXT_EXTENSIONS.has(filename.slice(filename.lastIndexOf('.')))
  );
}

function isText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function hasLikelySecret(buffer: Buffer): boolean {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9_+/=-]{16,}/i.test(
    buffer.subarray(0, 4_096).toString('utf8'),
  );
}

function byteLimit(limit: number): Transform {
  let size = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      callback(size > limit ? new Error('archive limit exceeded') : null, chunk);
    },
  });
}

function invalidArchive(): AppException {
  return AppException.badRequest(ErrorCode.INVALID_INPUT, 'Repository URL or content is invalid');
}
