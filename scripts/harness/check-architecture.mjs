import { basename } from 'node:path';
import { exists, issue, read, repoPath, walk } from './lib.mjs';

const allowedInternal = {
  '@ai-planning/shared': [],
  '@ai-planning/config': [],
  '@ai-planning/database': [],
  '@ai-planning/llm-core': ['@ai-planning/shared'],
  '@ai-planning/llm-providers': ['@ai-planning/llm-core', '@ai-planning/shared'],
  '@ai-planning/llm-orchestrator': [
    '@ai-planning/llm-core',
    '@ai-planning/llm-providers',
    '@ai-planning/shared',
  ],
  '@ai-planning/api': [
    '@ai-planning/config',
    '@ai-planning/database',
    '@ai-planning/llm-orchestrator',
    '@ai-planning/shared',
  ],
  '@ai-planning/web': [],
};

const workspacePaths = {
  'packages/shared': '@ai-planning/shared',
  'packages/config': '@ai-planning/config',
  'packages/database': '@ai-planning/database',
  'packages/llm-core': '@ai-planning/llm-core',
  'packages/llm-providers': '@ai-planning/llm-providers',
  'packages/llm-orchestrator': '@ai-planning/llm-orchestrator',
  'apps/api': '@ai-planning/api',
  'apps/web': '@ai-planning/web',
};

const forbiddenPackages = [
  'redis',
  'ioredis',
  'kafkajs',
  'graphql',
  '@apollo/server',
  'mongoose',
  'mongodb',
  'langchain',
  '@langchain/core',
  'llamaindex',
  'chromadb',
  '@modelcontextprotocol/sdk',
  '@grpc/grpc-js',
  'prom-client',
  'socket.io',
  'ws',
  'openai',
];

export function extractImports(source) {
  const imports = [];
  const pattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  for (const match of source.matchAll(/import\s+['"]([^'"]+)['"]/g)) imports.push(match[1]);
  return imports;
}

function checkManifest(path, workspace) {
  const manifest = JSON.parse(read(`${path}/package.json`));
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const allowed = new Set(allowedInternal[workspace]);
  const issues = [];
  for (const name of Object.keys(dependencies)) {
    if (name.startsWith('@ai-planning/') && !allowed.has(name)) {
      issues.push(
        issue(
          'HE-ARCH-001',
          `${path}/package.json declares forbidden internal dependency ${name}.`,
          `Use only the dependency direction allowed for ${workspace}.`,
          'docs/architecture-overview.md',
        ),
      );
    }
    if (forbiddenPackages.some((item) => name === item || name.startsWith(`${item}/`))) {
      issues.push(
        issue(
          'HE-ARCH-002',
          `${path}/package.json introduces forbidden package ${name}.`,
          'Use the approved stack or update the architecture with explicit approval first.',
          'docs/architecture-overview.md',
        ),
      );
    }
  }
  return issues;
}

function workspaceFor(file) {
  return Object.entries(workspacePaths).find(([path]) => file.startsWith(`${path}/`));
}

function orchestratorAllowed(file) {
  return (
    file.startsWith('apps/api/src/llm/') ||
    file.startsWith('apps/api/src/health/') ||
    file.startsWith('apps/api/src/modules/models/') ||
    file.startsWith('apps/api/src/modules/workflow/')
  );
}

function checkSource(file) {
  const source = read(file);
  const imports = extractImports(source);
  const entry = workspaceFor(file);
  if (!entry) return [];
  const [, workspace] = entry;
  const allowed = new Set(allowedInternal[workspace]);
  const issues = [];
  for (const name of imports.filter((item) => item.startsWith('@ai-planning/'))) {
    if (!allowed.has(name)) {
      issues.push(
        issue(
          'HE-ARCH-003',
          `${file} imports ${name} across a forbidden workspace edge.`,
          `Route the dependency through one of: ${[...allowed].join(', ') || 'no internal packages'}.`,
          'docs/architecture-overview.md',
        ),
      );
    }
  }
  if (file.startsWith('apps/api/src/') && imports.includes('@ai-planning/llm-orchestrator')) {
    if (!orchestratorAllowed(file)) {
      issues.push(
        issue(
          'HE-LLM-001',
          `${file} imports the Orchestrator outside the API whitelist.`,
          'Move the model operation into workflow or application wiring.',
          'docs/playbooks/llm-development.md',
        ),
      );
    }
    if (file.includes('/health/') || file.includes('/modules/models/')) {
      const methods = [...source.matchAll(/orchestrator\.(\w+)\s*\(/g)].map((match) => match[1]);
      if (methods.some((method) => method !== 'healthCheck')) {
        issues.push(
          issue(
            'HE-LLM-002',
            `${file} uses model-generation methods from a health/metadata module.`,
            'Only call orchestrator.healthCheck() here.',
            'docs/architecture-overview.md',
          ),
        );
      }
    }
  }
  if (basename(file).endsWith('.controller.ts') && /call(Single|Multi|WithFallback)/.test(source)) {
    issues.push(
      issue(
        'HE-LLM-003',
        `${file} calls an LLM from a Controller.`,
        'Keep HTTP binding in the Controller and move model work to workflow services.',
        'docs/playbooks/llm-development.md',
      ),
    );
  }
  return issues;
}

export function checkArchitecture() {
  const issues = [];
  for (const path of ['services', 'utils', 'lib']) {
    if (exists(path)) {
      issues.push(
        issue(
          'HE-ARCH-006',
          `Root directory ${path}/ is forbidden.`,
          'Place business code in the existing app or package that owns it.',
          'docs/architecture-overview.md',
        ),
      );
    }
  }
  for (const [path, workspace] of Object.entries(workspacePaths)) {
    issues.push(...checkManifest(path, workspace));
  }
  const sourceFiles = walk('.', (file) => /\.(ts|tsx)$/.test(file)).map(repoPath);
  for (const file of sourceFiles.filter((path) => path.includes('/src/'))) {
    issues.push(...checkSource(file));
    if (file.endsWith('.prompt.ts') && !file.startsWith('apps/api/src/prompts/')) {
      issues.push(
        issue(
          'HE-ARCH-004',
          `${file} is a Prompt outside apps/api/src/prompts/.`,
          'Move the Prompt to the canonical prompt directory.',
          'docs/playbooks/llm-development.md',
        ),
      );
    }
    if (file.endsWith('.schema.ts') && !file.startsWith('packages/shared/src/schemas/')) {
      issues.push(
        issue(
          'HE-ARCH-005',
          `${file} is a shared Schema outside packages/shared/src/schemas/.`,
          'Move cross-layer schemas to the shared schemas package.',
          'docs/architecture-overview.md',
        ),
      );
    }
  }
  return issues;
}
