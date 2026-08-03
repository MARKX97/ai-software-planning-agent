import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import type { UploadedKnowledgeFile } from './knowledge-parser.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface MarkdownSection {
  readonly content: string;
  readonly titlePath: string[];
  readonly startLine: number;
}

export function validateUpload(file: UploadedKnowledgeFile | undefined): {
  name: string;
  mimeType: string;
  extension: '.md' | '.txt' | '.pdf';
  content: string;
  buffer: Buffer;
} {
  if (!file?.buffer || file.size < 1) throw invalidFile('File is required and cannot be empty');
  if (file.size > MAX_FILE_BYTES) throw invalidFile('File exceeds the 20 MiB limit');
  const name = basename(file.originalname)
    // eslint-disable-next-line no-control-regex -- untrusted filename metadata must drop controls
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 255);
  const extension = extname(name).toLowerCase();
  if (extension !== '.md' && extension !== '.txt' && extension !== '.pdf')
    throw invalidFile('Only .md, .txt and .pdf files are supported');
  const allowedMime =
    extension === '.md'
      ? ['text/markdown', 'text/x-markdown', 'text/plain']
      : extension === '.pdf'
        ? ['application/pdf']
        : ['text/plain'];
  if (!allowedMime.includes(file.mimetype.toLowerCase()))
    throw invalidFile('File extension and MIME type do not match');
  if (extension === '.pdf') {
    if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-')
      throw invalidFile('File is not a valid PDF');
    return { name, mimeType: 'application/pdf', extension, content: '', buffer: file.buffer };
  }
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw invalidFile('File must be valid UTF-8 text');
  }
  content = normalizeText(content);
  if (!content.trim()) throw invalidFile('File has no indexable text');
  return {
    name,
    mimeType: extension === '.md' ? 'text/markdown' : 'text/plain',
    extension,
    content,
    buffer: file.buffer,
  };
}

export function normalizeText(content: string): string {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC');
}

export function markdownSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const headings: string[] = [];
  let lines: string[] = [];
  let startLine = 1;
  let titlePath: string[] = [];
  const flush = () => {
    if (lines.some((line) => line.trim()))
      sections.push({ content: lines.join('\n'), titlePath, startLine });
  };
  content.split('\n').forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return void lines.push(line);
    flush();
    const depth = match[1]?.length ?? 1;
    headings.splice(depth - 1, headings.length, match[2] ?? '');
    titlePath = headings.filter(Boolean);
    lines = [line];
    startLine = index + 1;
  });
  flush();
  return sections.length > 0 ? sections : [{ content, titlePath: [], startLine: 1 }];
}

export function documentTitle(name: string, sections: readonly MarkdownSection[]): string {
  return (
    sections.find((section) => section.titlePath[0])?.titlePath[0] ?? name.replace(/\.[^.]+$/, '')
  );
}

export function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function invalidFile(message: string): AppException {
  return AppException.badRequest(ErrorCode.INVALID_INPUT, message);
}
