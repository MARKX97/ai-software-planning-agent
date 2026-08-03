import { Injectable } from '@nestjs/common';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getEncoding } from 'js-tiktoken';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const encoder = getEncoding('cl100k_base');

export interface UploadedKnowledgeFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

export interface ParsedKnowledgeChunk {
  readonly position: number;
  readonly content: string;
  readonly tokenCount: number;
  readonly titlePath: string[];
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly contentHash: string;
}

export interface ParsedKnowledgeDocument {
  readonly name: string;
  readonly mimeType: string;
  readonly content: string;
  readonly contentHash: string;
  readonly title: string;
  readonly chunks: ParsedKnowledgeChunk[];
}

interface MarkdownSection {
  readonly content: string;
  readonly titlePath: string[];
  readonly startLine: number;
}

class UploadedTextLoader extends BaseDocumentLoader {
  constructor(
    private readonly content: string,
    private readonly source: string,
    private readonly mimeType: string,
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    return [
      new Document({
        pageContent: this.content,
        metadata: { source: this.source, mimeType: this.mimeType },
      }),
    ];
  }
}

@Injectable()
export class KnowledgeParser {
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 120,
    lengthFunction: (text) => encoder.encode(text).length,
  });

  async parse(file: UploadedKnowledgeFile): Promise<ParsedKnowledgeDocument> {
    const input = validateUpload(file);
    const [document] = await new UploadedTextLoader(
      input.content,
      input.name,
      input.mimeType,
    ).load();
    if (!document) throw invalidFile('File could not be loaded');
    const sections =
      input.extension === '.md'
        ? markdownSections(document.pageContent)
        : [{ content: document.pageContent, titlePath: [], startLine: 1 }];
    const chunks = await this.splitSections(sections);
    return {
      name: input.name,
      mimeType: input.mimeType,
      content: document.pageContent,
      contentHash: hash(document.pageContent),
      title: documentTitle(input.name, sections),
      chunks,
    };
  }

  private async splitSections(
    sections: readonly MarkdownSection[],
  ): Promise<ParsedKnowledgeChunk[]> {
    const chunks: ParsedKnowledgeChunk[] = [];
    for (const section of sections) {
      const documents = await this.splitter.createDocuments([section.content]);
      for (const document of documents) {
        const lines = document.metadata['loc']?.lines as { from: number; to: number } | undefined;
        const content = document.pageContent;
        chunks.push({
          position: chunks.length,
          content,
          tokenCount: encoder.encode(content).length,
          titlePath: section.titlePath,
          lineStart: section.startLine + (lines?.from ?? 1) - 1,
          lineEnd: section.startLine + (lines?.to ?? 1) - 1,
          contentHash: hash(content),
        });
      }
    }
    if (chunks.length === 0) throw invalidFile('File has no indexable text');
    return chunks;
  }
}

function validateUpload(file: UploadedKnowledgeFile | undefined): {
  name: string;
  mimeType: string;
  extension: '.md' | '.txt';
  content: string;
} {
  if (!file?.buffer || file.size < 1) throw invalidFile('File is required and cannot be empty');
  if (file.size > MAX_FILE_BYTES) throw invalidFile('File exceeds the 20 MiB limit');
  const name = basename(file.originalname)
    // eslint-disable-next-line no-control-regex -- untrusted filename metadata must drop controls
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 255);
  const extension = extname(name).toLowerCase();
  if (extension !== '.md' && extension !== '.txt')
    throw invalidFile('Only .md and .txt files are supported');
  const allowedMime =
    extension === '.md' ? ['text/markdown', 'text/x-markdown', 'text/plain'] : ['text/plain'];
  if (!allowedMime.includes(file.mimetype.toLowerCase()))
    throw invalidFile('File extension and MIME type do not match');
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw invalidFile('File must be valid UTF-8 text');
  }
  content = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC');
  if (!content.trim()) throw invalidFile('File has no indexable text');
  return {
    name,
    mimeType: extension === '.md' ? 'text/markdown' : 'text/plain',
    extension,
    content,
  };
}

function markdownSections(content: string): MarkdownSection[] {
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
    if (match) {
      flush();
      const depth = match[1]?.length ?? 1;
      headings.splice(depth - 1, headings.length, match[2] ?? '');
      titlePath = headings.filter(Boolean);
      lines = [line];
      startLine = index + 1;
    } else {
      lines.push(line);
    }
  });
  flush();
  return sections.length > 0 ? sections : [{ content, titlePath: [], startLine: 1 }];
}

function documentTitle(name: string, sections: readonly MarkdownSection[]): string {
  return (
    sections.find((section) => section.titlePath[0])?.titlePath[0] ?? name.replace(/\.[^.]+$/, '')
  );
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function invalidFile(message: string): AppException {
  return AppException.badRequest(ErrorCode.INVALID_INPUT, message);
}
