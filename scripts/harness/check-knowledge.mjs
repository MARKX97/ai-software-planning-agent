import { dirname, extname, resolve } from 'node:path';
import { exists, issue, read, repoPath, ROOT, trackedFiles, walk } from './lib.mjs';

const modelKeys = [
  ['BAISHAN_BASE_URL', 'baishanBaseUrl'],
  ['BAISHAN_MODEL_DEEPSEEK', 'modelDeepseek'],
  ['BAISHAN_MODEL_GLM', 'modelGlm'],
  ['BAISHAN_MODEL_MINIMAX', 'modelMinimax'],
];

export function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

export function markdownTargets(source) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)].map(
    (match) => match[1],
  );
}

function checkMarkdownLinks() {
  const issues = [];
  for (const absolute of walk('.', (file) => extname(file) === '.md')) {
    const file = repoPath(absolute);
    for (const raw of markdownTargets(read(file))) {
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      const target = decodeURIComponent(raw.split('#')[0]);
      if (!target) continue;
      const resolved = resolve(ROOT, dirname(file), target);
      if (!exists(repoPath(resolved))) {
        issues.push(
          issue(
            'HE-DOC-001',
            `${file} links to missing path ${raw}.`,
            'Fix or remove the local Markdown link.',
          ),
        );
      }
    }
  }
  return issues;
}

function checkOpenApiRefs() {
  const issues = [];
  const source = read('contracts/openapi.yaml');
  for (const match of source.matchAll(/\$ref:\s*['"]?([^'"\s]+)['"]?/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:)/.test(target)) continue;
    if (!exists(`contracts/${target.replace(/^\.\//, '')}`)) {
      issues.push(
        issue(
          'HE-DOC-002',
          `contracts/openapi.yaml references missing file ${target}.`,
          'Fix the OpenAPI $ref or add the referenced contract.',
          'specs/api.spec.md',
        ),
      );
    }
  }
  return issues;
}

function checkKnowledgeIndex() {
  const index = read('docs/README.md');
  const required = walk('specs', (file) => file.endsWith('.spec.md')).map((file) =>
    repoPath(file).replace('specs/', ''),
  );
  return required
    .filter((name) => !index.includes(name))
    .map((name) =>
      issue(
        'HE-DOC-003',
        `docs/README.md does not index specs/${name}.`,
        'Add the spec to the knowledge map under its owning topic.',
      ),
    );
}

function checkSchemaMirrors() {
  const issues = [];
  const jsonNames = walk('contracts/schemas/llm', (file) => file.endsWith('.json')).map((file) =>
    repoPath(file).split('/').at(-1).replace('.json', ''),
  );
  const zodNames = walk('packages/shared/src/schemas/llm', (file) =>
    file.endsWith('.schema.ts'),
  ).map((file) => repoPath(file).split('/').at(-1).replace('.schema.ts', ''));
  for (const name of new Set([...jsonNames, ...zodNames])) {
    if (!jsonNames.includes(name) || !zodNames.includes(name)) {
      issues.push(
        issue(
          'HE-DOC-004',
          `LLM schema ${name} is not mirrored in both JSON Schema and Zod.`,
          'Add the missing mirror and update specs/schema.spec.md.',
          'specs/schema.spec.md',
        ),
      );
    }
  }
  return issues;
}

function checkConfig() {
  const issues = [];
  const env = parseEnv(read('.env.example'));
  const config = read('apps/api/src/config/app-config.service.ts');
  const workflow = read('.github/workflows/test.yml');
  for (const [key, property] of modelKeys) {
    const match = config.match(new RegExp(`this\\.${property}\\s*=.*?\\?\\?\\s*'([^']+)'`));
    if (!match || match[1] !== env[key]) {
      issues.push(
        issue(
          'HE-CONFIG-001',
          `${key} differs between .env.example and AppConfigService.`,
          'Use the exact case-sensitive value from .env.example as the code fallback.',
          'docs/baishan-integration.md',
        ),
      );
    }
    const ci = workflow.match(new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\s]+)`, 'm'));
    if (ci && ci[1] !== env[key]) {
      issues.push(
        issue(
          'HE-CONFIG-002',
          `${key} differs between .env.example and GitHub Actions.`,
          'Remove the duplicate CI override or match .env.example.',
          'docs/playbooks/deployment.md',
        ),
      );
    }
  }
  return issues;
}

function checkSecrets() {
  const issues = [];
  const tracked = trackedFiles();
  for (const file of tracked) {
    if (/^\.env(?:\..+)?$/.test(file) && file !== '.env.example') {
      issues.push(
        issue(
          'HE-SEC-001',
          `${file} is a tracked environment file.`,
          'Untrack it and rotate exposed secrets.',
          'docs/playbooks/deployment.md',
        ),
      );
    }
    if (file === '.claude/settings.local.json') {
      issues.push(
        issue(
          'HE-SEC-002',
          `${file} is local state but is tracked.`,
          'Remove it from Git tracking.',
          'docs/playbooks/deployment.md',
        ),
      );
    }
  }
  const textFiles = tracked.filter((file) =>
    /\.(md|json|ya?ml|m?js|ts|tsx|env|example)$/.test(file),
  );
  for (const file of textFiles) {
    const source = read(file);
    if (/sk-[A-Za-z0-9_-]{20,}/.test(source)) {
      issues.push(
        issue(
          'HE-SEC-003',
          `${file} appears to contain a real API key.`,
          'Remove the value and rotate the key immediately.',
          'docs/playbooks/deployment.md',
        ),
      );
    }
  }
  for (const absolute of walk('apps/web/src', (file) => /\.(ts|tsx)$/.test(file))) {
    const file = repoPath(absolute);
    const source = read(file);
    if (/\b(BAISHAN_API_KEY|BAISHAN_BASE_URL|DATABASE_URL|DOWNLOAD_TOKEN_SECRET)\b/.test(source)) {
      issues.push(
        issue(
          'HE-SEC-004',
          `${file} references a server-only secret/config name.`,
          'Move access to the API server and expose only a safe API response.',
          'docs/playbooks/deployment.md',
        ),
      );
    }
    for (const match of source.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!match[1].startsWith('NEXT_PUBLIC_')) {
        issues.push(
          issue(
            'HE-SEC-005',
            `${file} reads non-public environment variable ${match[1]}.`,
            'Use a NEXT_PUBLIC_ variable only for non-secret browser config.',
            'docs/playbooks/deployment.md',
          ),
        );
      }
    }
  }
  return issues;
}

function checkDockerContext() {
  const required = ['.git', '.env*', 'node_modules', 'data', 'output', 'tmp'];
  if (!exists('.dockerignore')) {
    return [
      issue(
        'HE-SEC-006',
        'Docker build context has no .dockerignore.',
        'Add .dockerignore and exclude local secrets, dependencies, outputs and data.',
        'docs/playbooks/deployment.md',
      ),
    ];
  }
  const entries = new Set(
    read('.dockerignore')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );
  return required
    .filter((entry) => !entries.has(entry))
    .map((entry) =>
      issue(
        'HE-SEC-006',
        `.dockerignore does not exclude ${entry}.`,
        'Exclude the path from Docker build context.',
        'docs/playbooks/deployment.md',
      ),
    );
}

export function checkKnowledge() {
  return [
    ...checkMarkdownLinks(),
    ...checkOpenApiRefs(),
    ...checkKnowledgeIndex(),
    ...checkSchemaMirrors(),
    ...checkConfig(),
    ...checkSecrets(),
    ...checkDockerContext(),
  ];
}
