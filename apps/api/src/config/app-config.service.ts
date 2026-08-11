import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/**
 * Reads app-level configuration from environment variables.
 *
 * Centralizes env access so that no other module needs to call `process.env`
 * directly. Falls back to safe defaults for local development.
 *
 * @internal
 */
@Injectable()
export class AppConfigService {
  /** API server port (default 3001). */
  readonly port: number;
  /** API bind host (loopback by default). */
  readonly apiHost: string;
  /** Exact browser origins allowed by CORS. */
  readonly corsAllowedOrigins: readonly string[];
  /** Shared API key for authenticating requests; empty when auth disabled. */
  readonly apiKey: string;
  /** Base directory for generated artifacts. */
  readonly dataDir: string;
  /** Log level: DEBUG | INFO | WARN | ERROR. */
  readonly logLevel: string;
  /** PostgreSQL connection string used by Prisma. */
  readonly databaseUrl: string;
  /** Baishan OpenAI-compatible base URL. */
  readonly baishanBaseUrl: string;
  /** Baishan API key. */
  readonly baishanApiKey: string;
  /** Baishan model IDs for the three providers. */
  readonly modelDeepseek: string;
  readonly modelGlm: string;
  readonly modelMinimax: string;
  /** Embedding provider is configured independently from Chat LLM providers. */
  readonly embeddingProvider: 'mock' | 'openai-compatible';
  readonly embeddingBaseUrl: string;
  readonly embeddingApiKey: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  readonly ragEnabled: boolean;
  readonly workflowRunner: 'graph' | 'v2';
  readonly agentActionsEnabled: boolean;
  /** Per-project LLM cost ceiling (CNY). */
  readonly costLimitPerProject: number;
  /** Model-producing workflow operations allowed per project/caller each minute. */
  readonly workflowRateLimitPerMinute: number;
  /** API version surfaced in health/payloads. */
  readonly version: string;
  /** Secret used to derive short-lived export download tokens. */
  readonly downloadTokenSecret: string;

  constructor() {
    this.port = this.parsePort(process.env['API_PORT'], 3001);
    this.apiHost = process.env['API_HOST']?.trim() || '127.0.0.1';
    this.corsAllowedOrigins = this.parseOrigins(process.env['CORS_ALLOWED_ORIGINS']);
    this.apiKey = process.env['API_KEY']?.trim() ?? '';
    if (!this.apiKey && !this.isLoopbackHost(this.apiHost)) {
      throw new Error('API_KEY is required when API_HOST is not loopback');
    }
    this.dataDir = process.env['DATA_DIR'] ?? './data';
    this.logLevel = process.env['LOG_LEVEL'] ?? 'DEBUG';
    this.databaseUrl = process.env['DATABASE_URL'] ?? '';
    this.baishanBaseUrl = process.env['BAISHAN_BASE_URL'] ?? 'https://api.edgefn.net/v1';
    this.baishanApiKey = process.env['BAISHAN_API_KEY'] ?? '';
    this.modelDeepseek = process.env['BAISHAN_MODEL_DEEPSEEK'] ?? 'DeepSeek-R1-0528';
    this.modelGlm = process.env['BAISHAN_MODEL_GLM'] ?? 'GLM-4.5';
    this.modelMinimax = process.env['BAISHAN_MODEL_MINIMAX'] ?? 'MiniMax-M2.5';
    this.embeddingProvider = this.parseEmbeddingProvider(process.env['EMBEDDING_PROVIDER']);
    this.embeddingBaseUrl = process.env['EMBEDDING_BASE_URL'] ?? '';
    this.embeddingApiKey = process.env['EMBEDDING_API_KEY'] ?? '';
    this.embeddingModel = process.env['EMBEDDING_MODEL'] ?? 'mock-embedding-v1';
    this.embeddingDimensions = this.parsePositiveInt(process.env['EMBEDDING_DIMENSIONS'], 8, 4096);
    this.ragEnabled = this.parseBoolean('RAG_ENABLED', process.env['RAG_ENABLED'], true);
    this.workflowRunner = this.parseWorkflowRunner(process.env['WORKFLOW_RUNNER']);
    this.agentActionsEnabled = this.parseBoolean(
      'AGENT_ACTIONS_ENABLED',
      process.env['AGENT_ACTIONS_ENABLED'],
      true,
    );
    this.costLimitPerProject = this.parseNumber(process.env['COST_MAX_COST_PER_PROJECT'], 5);
    this.workflowRateLimitPerMinute = this.parseNonNegativeInt(
      process.env['WORKFLOW_RATE_LIMIT_PER_MINUTE'],
      10,
    );
    this.version = process.env['API_VERSION'] ?? '1.0.0';
    this.downloadTokenSecret =
      process.env['DOWNLOAD_TOKEN_SECRET'] || this.apiKey || randomBytes(32).toString('hex');
  }

  private parsePort(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseOrigins(value: string | undefined): readonly string[] {
    const configured = value ?? 'http://localhost:3000,http://127.0.0.1:3000';
    const origins = configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => this.parseOrigin(origin));
    if (origins.length === 0) throw new Error('CORS_ALLOWED_ORIGINS must not be empty');
    return [...new Set(origins)];
  }

  private parseOrigin(origin: string): string {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }
    return url.origin;
  }

  private isLoopbackHost(host: string): boolean {
    const normalized = host.toLowerCase();
    return normalized === 'localhost' || normalized === '::1' || /^127(?:\.|$)/.test(normalized);
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseNonNegativeInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private parsePositiveInt(value: string | undefined, fallback: number, maximum: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
  }

  private parseEmbeddingProvider(value: string | undefined): 'mock' | 'openai-compatible' {
    if (!value || value === 'mock') return 'mock';
    if (value === 'openai-compatible') return value;
    throw new Error('EMBEDDING_PROVIDER must be mock or openai-compatible');
  }

  private parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${name} must be true or false`);
  }

  private parseWorkflowRunner(value: string | undefined): 'graph' | 'v2' {
    if (!value || value === 'graph') return 'graph';
    if (value === 'v2') return value;
    throw new Error('WORKFLOW_RUNNER must be graph or v2');
  }
}
