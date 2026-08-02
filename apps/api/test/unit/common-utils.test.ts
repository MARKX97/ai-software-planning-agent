import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { omitNulls, toIso } from '../../src/common/dto/mappers.js';
import {
  containsSensitiveText,
  redactSensitiveText,
  safeUserTextSchema,
} from '../../src/common/security/sensitive-text.js';

describe('common DTO and security helpers', () => {
  it('maps dates and removes only nullish response fields', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    assert.equal(toIso(date), '2026-01-01T00:00:00.000Z');
    assert.equal(toIso(null), null);
    assert.deepEqual(
      omitNulls({ zero: 0, empty: '', nope: false, nil: null, missing: undefined }),
      {
        zero: 0,
        empty: '',
        nope: false,
      },
    );
  });

  it('detects and redacts supported credential shapes', () => {
    const prefixed = ['sk-', 'abcdefghijklmnop'].join('');
    const assigned = ['api_key=', 'abcdefghijklmnopqrstuvwxyz'].join('');
    assert.equal(containsSensitiveText(prefixed), true);
    assert.equal(containsSensitiveText(assigned), true);
    assert.equal(containsSensitiveText('ordinary planning text'), false);
    assert.equal(
      redactSensitiveText(`first ${prefixed}; second ${assigned}`),
      'first [REDACTED]; second [REDACTED]',
    );
  });

  it('rejects empty, oversized and sensitive user-authored text', () => {
    const schema = safeUserTextSchema(5);
    assert.equal(schema.safeParse('').success, false);
    assert.equal(schema.safeParse('123456').success, false);
    assert.equal(schema.safeParse('hello').success, true);
    assert.equal(
      safeUserTextSchema(100).safeParse(['sk-', 'abcdefghijklmnop'].join('')).success,
      false,
    );
  });
});
