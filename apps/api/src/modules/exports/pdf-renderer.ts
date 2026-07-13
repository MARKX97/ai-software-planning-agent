const PAGE_LINES = 48;
const LINE_CHARS = 72;

/** Render plain Unicode text as a small, dependency-free PDF document. */
export function renderPdf(text: string): Buffer {
  const pages = paginate(text);
  const pageObjects = pages.map((_, index) => 5 + index * 2);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageObjects.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>',
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> >>',
  ];
  for (const [index, lines] of pages.entries()) {
    const contentId = 6 + index * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      streamObject(pageStream(lines)),
    );
  }
  return assemblePdf(objects);
}

function paginate(text: string): string[][] {
  const lines = text.split(/\r?\n/).flatMap(wrapLine);
  const pages: string[][] = [];
  for (let index = 0; index < Math.max(lines.length, 1); index += PAGE_LINES) {
    pages.push(lines.slice(index, index + PAGE_LINES));
  }
  return pages.length ? pages : [['']];
}

function wrapLine(line: string): string[] {
  if (!line) return [''];
  const parts: string[] = [];
  for (let index = 0; index < line.length; index += LINE_CHARS) {
    parts.push(line.slice(index, index + LINE_CHARS));
  }
  return parts;
}

function pageStream(lines: string[]): string {
  const commands = lines.map((line) => `<${utf16Hex(line)}> Tj T*`).join('\n');
  return `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${commands}\nET`;
}

function utf16Hex(value: string): string {
  const littleEndian = Buffer.from(value, 'utf16le');
  for (let index = 0; index < littleEndian.length; index += 2) {
    [littleEndian[index], littleEndian[index + 1]] = [littleEndian[index + 1], littleEndian[index]];
  }
  return littleEndian.toString('hex').toUpperCase();
}

function streamObject(content: string): string {
  return `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
}

function assemblePdf(objects: string[]): Buffer {
  const parts = [Buffer.from('%PDF-1.4\n%\x80\x80\x80\x80\n', 'binary')];
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`));
  }
  const xrefOffset = parts.reduce((sum, part) => sum + part.length, 0);
  const xref = offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    ),
  );
  return Buffer.concat(parts);
}
