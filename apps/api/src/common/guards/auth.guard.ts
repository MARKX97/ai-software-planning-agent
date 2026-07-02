import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../config/app-config.service.js';
import { AppException } from '../exception/app-exception.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Bearer-token auth guard.
 *
 * Behaviour (specs/api.spec.md §2):
 * - When `API_KEY` is empty, auth is disabled — every request passes.
 * - Routes marked `@Public()` (health, models) always pass.
 * - Otherwise the `Authorization: Bearer <token>` header must equal `API_KEY`.
 *
 * @internal
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.apiKey) return true;
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest();
    const header = String(request.headers['authorization'] ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw AppException.unauthorized();
    if (token !== this.config.apiKey) throw AppException.forbidden();
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
