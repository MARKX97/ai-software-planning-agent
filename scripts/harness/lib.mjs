import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

export function exists(path) {
  return existsSync(resolve(ROOT, path));
}

export function repoPath(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

export function walk(path, accept = () => true) {
  const start = resolve(ROOT, path);
  if (!existsSync(start)) return [];
  const files = [];
  const visit = (entry) => {
    const stats = statSync(entry);
    if (stats.isDirectory()) {
      if (/\/(node_modules|dist|build|generated|\.next|\.turbo)(\/|$)/.test(entry)) return;
      for (const child of readdirSync(entry)) visit(resolve(entry, child));
      return;
    }
    if (accept(entry)) files.push(entry);
  };
  visit(start);
  return files;
}

export function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

export function issue(rule, message, fix, doc = 'docs/README.md') {
  return { rule, message, fix, doc };
}

export function printResult(issues) {
  if (issues.length === 0) {
    process.stdout.write('Harness checks passed.\n');
    return;
  }
  for (const item of issues) {
    process.stderr.write(
      `[${item.rule}] ${item.message}\n  Fix: ${item.fix}\n  Docs: ${item.doc}\n`,
    );
  }
  process.stderr.write(`Harness checks failed: ${issues.length} issue(s).\n`);
  process.exitCode = 1;
}
