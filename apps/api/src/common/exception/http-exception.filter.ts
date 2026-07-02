import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ZodError } from 'zod';
import { ErrorCode } from './error-code.js';
import { AppException } from './app-exception.js';

interface ErrorPayload {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

/**
 * Global exception filter that normalizes every thrown exception into the
 * unified `{ error: { code, message, details? } }` shape required by
 * specs/api.spec.md §2 / §4.3.
 *
 * @internal
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const payload = this.toPayload(exception);
    response.status(this.toStatus(exception)).json(payload);
  }

  private toPayload(err: unknown): ErrorPayload {
    const norm = this.normalize(err);
    const error: ErrorPayload['error'] = { code: norm.code, message: norm.message };
    if (norm.details) error.details = norm.details;
    return { error };
  }

  private toStatus(err: unknown): number {
    if (err instanceof AppException || err instanceof HttpException) return err.getStatus();
    if (err instanceof ZodError) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private normalize(err: unknown): {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } {
    if (err instanceof AppException) {
      const res = err.getResponse() as {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      return { code: res.code, message: res.message, details: res.details };
    }
    if (err instanceof ZodError) {
      return {
        code: ErrorCode.INVALID_INPUT,
        message: 'Request validation failed',
        details: { issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
      };
    }
    if (err instanceof HttpException) {
      const res = err.getResponse();
      const message =
        typeof res === 'string' ? res : ((res as { message?: string }).message ?? err.message);
      return { code: ErrorCode.INTERNAL_ERROR, message };
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    return { code: ErrorCode.INTERNAL_ERROR, message };
  }
}
