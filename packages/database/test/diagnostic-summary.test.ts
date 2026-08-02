import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeDiagnosticText } from '../src/diagnostic-summary.js';

describe('summarizeDiagnosticText', () => {
  it('redacts supported credential shapes', () => {
    const prefixed = ['sk-', 'abcdefgh12345678'].join('');
    const assigned = ['api_key=', 'secret-value'].join('');
    const result = summarizeDiagnosticText(`${prefixed} ${assigned}`);
    assert.equal(result, '[REDACTED] api_key=[REDACTED]');
  });

  it('truncates diagnostic content without exceeding the limit', () => {
    const result = summarizeDiagnosticText('x'.repeat(300));
    assert.equal(result.length, 240);
    assert.match(result, /\.\.\.$/);
  });
});
