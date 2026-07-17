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
  /** Per-project LLM cost ceiling (CNY). */
  readonly costLimitPerProject: number;
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
    this.costLimitPerProject = this.parseNumber(process.env['COST_MAX_COST_PER_PROJECT'], 5);
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
}
