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
    this.apiKey = process.env['API_KEY'] ?? '';
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
    this.ragEnabled = this.parseBoolean(process.env['RAG_ENABLED'], true);
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

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error('RAG_ENABLED must be true or false');
  }
}
