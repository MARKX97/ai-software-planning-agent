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
    const key = this.key(request);
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
      this.prune(now);
      return true;
    }
    if (entry.count >= limit) {
      throw AppException.rateLimited({
        retry_after_seconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      });
    }
    entry.count += 1;
    return true;
  }

  private key(request: RequestLike): string {
    const authorization = String(request.headers['authorization'] ?? '');
    const caller = authorization || request.ip || request.socket?.remoteAddress || 'unknown';
    const digest = createHash('sha256').update(caller).digest('hex').slice(0, 16);
    return `${request.params?.['project_id'] ?? 'unknown'}:${digest}`;
  }

  private prune(now: number): void {
    if (this.windows.size < 1000) return;
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
  }
}
