import { Injectable } from '@nestjs/common';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { getEncoding } from 'js-tiktoken';
import { extname } from 'node:path';
import { AppException } from '../../common/exception/app-exception.js';
import {
  documentTitle,
  hash,
  invalidFile,
  markdownSections,
  normalizeText,
  validateUpload,
  type MarkdownSection,
} from './knowledge-parser-utils.js';
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
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly pageNumber?: number;
  readonly contentHash: string;
}

export interface ParsedKnowledgeDocument {
  readonly name: string;
  readonly mimeType: string;
  readonly content: string;
  readonly contentHash: string;
  readonly title: string;
  readonly repositoryCommit?: string;
  readonly chunks: ParsedKnowledgeChunk[];
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
    if (input.extension === '.pdf') return this.parsePdf(input.name, input.buffer);
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

  async parseRepositoryFile(
    path: string,
    content: string,
    repositoryCommit: string,
  ): Promise<ParsedKnowledgeDocument> {
    const normalized = normalizeText(content);
    if (!normalized.trim()) throw invalidFile('Repository file has no indexable text');
    const extension = extname(path).toLowerCase();
    const sections =
      extension === '.md'
        ? markdownSections(normalized)
        : [{ content: normalized, titlePath: [], startLine: 1 }];
    return {
      name: path,
      mimeType: extension === '.md' ? 'text/markdown' : 'text/plain',
      content: normalized,
      contentHash: hash(normalized),
      title: documentTitle(path, sections),
      repositoryCommit,
      chunks: await this.splitSections(sections),
    };
  }

  private async parsePdf(name: string, buffer: Buffer): Promise<ParsedKnowledgeDocument> {
    installPdfPolyfills();
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText({ pageJoiner: '' });
      const chunks: ParsedKnowledgeChunk[] = [];
      for (const page of result.pages) {
        const content = normalizeText(page.text);
        if (!content.trim()) continue;
        const pageChunks = await this.splitSections([
          { content, titlePath: [`Page ${page.num}`], startLine: 1 },
        ]);
        pageChunks.forEach((chunk) =>
          chunks.push({
            ...chunk,
            position: chunks.length,
            lineStart: undefined,
            lineEnd: undefined,
            pageNumber: page.num,
          }),
        );
      }
      if (chunks.length === 0) throw invalidFile('PDF has no indexable text');
      const content = result.pages.map((page) => normalizeText(page.text)).join('\n\n');
      return {
        name,
        mimeType: 'application/pdf',
        content,
        contentHash: hash(content),
        title: name.replace(/\.pdf$/i, ''),
        chunks,
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw invalidFile('PDF could not be parsed');
    } finally {
      await parser.destroy();
    }
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

function installPdfPolyfills(): void {
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
}
