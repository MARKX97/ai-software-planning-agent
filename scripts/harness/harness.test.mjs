import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractImports } from './check-architecture.mjs';
import { metricFromMessage } from './check-code-shape.mjs';
import { markdownTargets, parseEnv } from './check-knowledge.mjs';

describe('harness parsers', () => {
  it('extracts static and dynamic imports', () => {
    assert.deepEqual(extractImports("import x from 'a'; const y = import(\"b\"); import 'c';"), [
      'a',
      'b',
      'c',
    ]);
  });

  it('parses env values without treating comments as keys', () => {
    assert.deepEqual(parseEnv('# comment\nMODEL=Case-Sensitive\nEMPTY=\n'), {
      MODEL: 'Case-Sensitive',
      EMPTY: '',
    });
  });

  it('extracts local Markdown targets', () => {
    assert.deepEqual(markdownTargets('[Docs](./docs/a.md) and [Web](https://example.com)'), [
      './docs/a.md',
      'https://example.com',
    ]);
  });

  it('normalizes ESLint shape violations into stable keys', () => {
    assert.deepEqual(
      metricFromMessage('file.ts', {
        ruleId: 'max-lines-per-function',
        message: "Function 'run' has too many lines (60). Maximum allowed is 50.",
      }),
      { key: 'file.ts#run', value: 60 },
    );
  });
});
