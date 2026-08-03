import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  KnowledgeParser,
  type UploadedKnowledgeFile,
} from '../../src/modules/knowledge/knowledge-parser.js';

function upload(name: string, mime: string, content: string): UploadedKnowledgeFile {
  const buffer = Buffer.from(content, 'utf8');
  return { originalname: name, mimetype: mime, size: buffer.byteLength, buffer };
}

function pdf(text: string): UploadedKnowledgeFile {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length + 31} >>\nstream\nBT /F1 18 Tf 72 720 Td (${text}) Tj ET\nendstream`,
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  content += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const buffer = Buffer.from(content, 'ascii');
  return {
    originalname: 'guide.pdf',
    mimetype: 'application/pdf',
    size: buffer.byteLength,
    buffer,
  };
}

describe('KnowledgeParser', () => {
  it('creates stable token chunks, hashes, lines, and Markdown title paths', async () => {
    const parser = new KnowledgeParser();
    const file = upload(
      'guide.md',
      'text/markdown',
      '# Guide\n\nIntro\n\n## Setup\n\n' + 'Install the service. '.repeat(900),
    );
    const first = await parser.parse(file);
    const second = await parser.parse(file);

    assert.equal(first.title, 'Guide');
    assert.deepEqual(first.chunks, second.chunks);
    assert.ok(first.chunks.length > 2);
    assert.ok(first.chunks.every((chunk) => chunk.tokenCount <= 800));
    assert.ok(first.chunks.every((chunk) => /^[a-f0-9]{64}$/.test(chunk.contentHash)));
    assert.deepEqual(first.chunks.at(-1)?.titlePath, ['Guide', 'Setup']);
    assert.ok(first.chunks.every((chunk) => chunk.lineEnd >= chunk.lineStart));
    const chinese = await parser.parse(
      upload('中文.txt', 'text/plain', '这是不会在字节边界损坏的中文内容。'.repeat(1000)),
    );
    assert.ok(chinese.chunks.every((chunk) => !chunk.content.includes('\uFFFD')));
  });

  it('normalizes UTF-8 line endings before hashing TXT input', async () => {
    const parser = new KnowledgeParser();
    const windows = await parser.parse(upload('notes.txt', 'text/plain', 'one\r\ntwo\r\n'));
    const unix = await parser.parse(upload('notes.txt', 'text/plain', 'one\ntwo\n'));
    assert.equal(windows.content, 'one\ntwo\n');
    assert.equal(windows.contentHash, unix.contentHash);
  });

  it('extracts embedded PDF text with a page locator', async () => {
    const parsed = await new KnowledgeParser().parse(pdf('PDF deployment guide'));
    assert.equal(parsed.mimeType, 'application/pdf');
    assert.match(parsed.content, /PDF deployment guide/);
    assert.equal(parsed.chunks[0]?.pageNumber, 1);
    assert.equal(parsed.chunks[0]?.lineStart, undefined);
  });

  it('rejects empty, unsupported, mismatched, and invalid UTF-8 files', async () => {
    const parser = new KnowledgeParser();
    await assert.rejects(() => parser.parse(upload('empty.txt', 'text/plain', '   ')));
    await assert.rejects(() => parser.parse(upload('guide.pdf', 'application/pdf', 'text')));
    await assert.rejects(() => parser.parse(upload('guide.txt', 'text/markdown', 'text')));
    await assert.rejects(() =>
      parser.parse({
        originalname: 'bad.txt',
        mimetype: 'text/plain',
        size: 2,
        buffer: Buffer.from([0xc3, 0x28]),
      }),
    );
  });
});
