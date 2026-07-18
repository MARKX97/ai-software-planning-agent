import { spawnSync } from 'node:child_process';
import { issue, read, repoPath, ROOT, walk } from './lib.mjs';

const rules = [
  '--rule',
  'max-lines:[error,{max:200,skipBlankLines:true,skipComments:true}]',
  '--rule',
  'max-lines-per-function:[error,{max:50,skipBlankLines:true,skipComments:true,IIFEs:true}]',
  '--rule',
  'max-params:[error,3]',
];

export function metricFromMessage(file, message) {
  const value = Number(message.message.match(/\((\d+)\)/)?.[1]);
  if (!Number.isFinite(value)) return null;
  if (message.ruleId === 'max-lines') return { key: file, value };
  const name = message.message.match(/(?:function|method) '([^']+)'/i)?.[1] ?? 'constructor';
  return { key: `${file}#${name}`, value };
}

function eslintMetrics() {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'eslint',
      'apps/*/src/**/*.{ts,tsx}',
      'packages/*/src/**/*.ts',
      '--format',
      'json',
      ...rules,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  if (!result.stdout) throw new Error(result.stderr || 'ESLint did not return JSON output.');
  const reports = JSON.parse(result.stdout);
  const metrics = { 'max-lines': {}, 'max-lines-per-function': {}, 'max-params': {} };
  for (const report of reports) {
    const file = repoPath(report.filePath);
    for (const message of report.messages) {
      if (!(message.ruleId in metrics)) continue;
      const metric = metricFromMessage(file, message);
      if (metric) metrics[message.ruleId][metric.key] = metric.value;
    }
  }
  return metrics;
}

function checkProductionShape() {
  const baseline = JSON.parse(read('scripts/harness/code-shape-baseline.json'));
  const current = eslintMetrics();
  const issues = [];
  for (const [rule, metrics] of Object.entries(current)) {
    for (const [key, value] of Object.entries(metrics)) {
      const ceiling = baseline[rule]?.[key];
      if (ceiling === undefined || value > ceiling) {
        issues.push(
          issue(
            'HE-SHAPE-001',
            `${key} violates ${rule} at ${value}${ceiling ? ` (baseline ${ceiling})` : ''}.`,
            'Refactor below the rule threshold; do not add or expand a baseline exception.',
            'docs/tech-debt.md',
          ),
        );
      }
    }
    for (const key of Object.keys(baseline[rule] ?? {})) {
      if (!(key in metrics)) {
        issues.push(
          issue(
            'HE-SHAPE-002',
            `${key} no longer violates ${rule}, but its baseline entry remains.`,
            'Delete the stale entry from code-shape-baseline.json and update tech debt.',
            'docs/tech-debt.md',
          ),
        );
      }
    }
  }
  return issues;
}

function checkTestFileSize() {
  const issues = [];
  const tests = walk('.', (file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
  for (const absolute of tests) {
    const lines = read(repoPath(absolute)).split(/\r?\n/).length;
    if (lines > 350) {
      issues.push(
        issue(
          'HE-SHAPE-003',
          `${repoPath(absolute)} has ${lines} lines; test files are limited to 350.`,
          'Split the test by behavior or subsystem.',
          'docs/playbooks/testing.md',
        ),
      );
    }
  }
  return issues;
}

export function checkCodeShape() {
  return [...checkProductionShape(), ...checkTestFileSize()];
}
