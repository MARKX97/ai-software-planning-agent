import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Subject } from 'rxjs';
import {
  assertChunkCount,
  assertExtractedCharacters,
  assertPdfPages,
  MAX_CHUNKS_PER_SOURCE,
  MAX_EXTRACTED_CHARACTERS,
  MAX_PDF_PAGES,
} from '../../src/modules/knowledge/knowledge-limits.js';
import { KnowledgeWriteAdmissionInterceptor } from '../../src/modules/knowledge/knowledge-write-admission.interceptor.js';

describe('knowledge resource limits', () => {
  it('rejects pages, extracted characters and chunks above their caps', () => {
    assert.throws(() => assertPdfPages(MAX_PDF_PAGES + 1));
    assert.throws(() => assertExtractedCharacters(MAX_EXTRACTED_CHARACTERS + 1));
    assert.throws(() => assertChunkCount(MAX_CHUNKS_PER_SOURCE + 1));
    assert.doesNotThrow(() => {
      assertPdfPages(MAX_PDF_PAGES);
      assertExtractedCharacters(MAX_EXTRACTED_CHARACTERS);
      assertChunkCount(MAX_CHUNKS_PER_SOURCE);
    });
  });

  it('admits only two concurrent knowledge writes and releases completed slots', () => {
    const admission = new KnowledgeWriteAdmissionInterceptor();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    admission.intercept({} as never, { handle: () => first } as never).subscribe();
    admission.intercept({} as never, { handle: () => second } as never).subscribe();
    assert.throws(() => admission.intercept({} as never, { handle: () => new Subject() } as never));
    first.complete();
    assert.doesNotThrow(() =>
      admission.intercept({} as never, { handle: () => new Subject() } as never),
    );
    second.complete();
  });
});
