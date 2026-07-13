import type { Artifact, ExportFormat } from '@ai-planning/database';
import { renderPdf } from './pdf-renderer.js';

export interface RenderedExport {
  readonly content: Buffer;
  readonly extension: string;
  readonly contentType: string;
}

/** Render selected artifacts into one of the formats declared by OpenAPI. */
export function renderExport(format: ExportFormat, artifacts: Artifact[]): RenderedExport {
  const markdown = artifacts
    .map((artifact) => `# ${artifact.title}\n\n${artifact.content}`)
    .join('\n\n---\n\n');
  if (format === 'pdf') {
    return { content: renderPdf(markdown), extension: 'pdf', contentType: 'application/pdf' };
  }
  if (format === 'html') {
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body><pre>${escapeHtml(markdown)}</pre></body></html>`;
    return {
      content: Buffer.from(html),
      extension: 'html',
      contentType: 'text/html; charset=utf-8',
    };
  }
  if (format === 'json') {
    const json = artifacts.map(({ type, title, content }) => ({ type, title, content }));
    return {
      content: Buffer.from(JSON.stringify(json, null, 2)),
      extension: 'json',
      contentType: 'application/json; charset=utf-8',
    };
  }
  return {
    content: Buffer.from(markdown),
    extension: 'md',
    contentType: 'text/markdown; charset=utf-8',
  };
}

export function exportContentType(format: ExportFormat): string {
  return {
    markdown: 'text/markdown; charset=utf-8',
    pdf: 'application/pdf',
    html: 'text/html; charset=utf-8',
    json: 'application/json; charset=utf-8',
  }[format];
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
