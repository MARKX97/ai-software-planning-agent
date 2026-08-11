import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';

export const MAX_PDF_PAGES = 200;
export const MAX_EXTRACTED_CHARACTERS = 2_000_000;
export const MAX_CHUNKS_PER_SOURCE = 2_000;
export const MAX_CONCURRENT_KNOWLEDGE_INDEXES = 2;

export function assertExtractedCharacters(count: number): void {
  if (count > MAX_EXTRACTED_CHARACTERS) throw limitError('extracted character');
}

export function assertPdfPages(count: number): void {
  if (count > MAX_PDF_PAGES) throw limitError('PDF page');
}

export function assertChunkCount(count: number): void {
  if (count > MAX_CHUNKS_PER_SOURCE) throw limitError('chunk');
}

function limitError(kind: string): AppException {
  return AppException.badRequest(
    ErrorCode.INVALID_INPUT,
    `Knowledge source exceeds the ${kind} limit`,
  );
}
