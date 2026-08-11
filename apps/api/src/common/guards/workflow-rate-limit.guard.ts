import { createHash } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppException } from '../exception/app-exception.js';

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface RequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip?: string;
  readonly params?: Record<string, string | undefined>;
  readonly socket?: { readonly remoteAddress?: string };
}

const WINDOW_MS = 60_000;
export const MAX_RATE_LIMIT_BUCKETS = 10_000;

/** Per-process admission limit for model-producing workflow operations. */
@Injectable()
export class WorkflowRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const limit = this.config.workflowRateLimitPerMinute;
    if (limit === 0) return true;
    const request = context.switchToHttp().getRequest<RequestLike>();
    const now = Date.now();
    const caller = this.callerKey(request);
    this.consume(`caller:${caller}`, limit, now);
    this.consume(`project:${request.params?.['project_id'] ?? 'unknown'}:${caller}`, limit, now);
    return true;
  }

  private consume(key: string, limit: number, now: number): void {
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      if (!entry) this.reserveBucket(now);
      this.windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }
    if (entry.count >= limit) {
      throw AppException.rateLimited({
        retry_after_seconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      });
    }
    entry.count += 1;
  }

  private callerKey(request: RequestLike): string {
    const caller = this.config.apiKey
      ? String(request.headers['authorization'] ?? '')
      : normalizedIp(request.ip ?? request.socket?.remoteAddress);
    const digest = createHash('sha256').update(caller).digest('hex').slice(0, 16);
    return digest;
  }

  private reserveBucket(now: number): void {
    if (this.windows.size < MAX_RATE_LIMIT_BUCKETS) return;
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
    if (this.windows.size >= MAX_RATE_LIMIT_BUCKETS) {
      throw AppException.rateLimited({ retry_after_seconds: 60 });
    }
  }
}

function normalizedIp(value?: string): string {
  const ip = (value ?? 'unknown').trim().toLowerCase();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
