import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-code.js';

/**
 * Application-level exception carrying a stable {@link ErrorCode} plus the
 * unified `{ error: { code, message, details? } }` payload.
 *
 * @internal
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor({ code, message, httpStatus, details }: AppExceptionInput) {
    super({ code, message, details }, httpStatus);
    this.code = code;
    this.details = details;
  }

  static badRequest(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AppException {
    return new AppException({ code, message, httpStatus: HttpStatus.BAD_REQUEST, details });
  }

  static notFound(code: ErrorCode, message: string): AppException {
    return new AppException({ code, message, httpStatus: HttpStatus.NOT_FOUND });
  }

  static conflict(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AppException {
    return new AppException({ code, message, httpStatus: HttpStatus.CONFLICT, details });
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException({
      code: ErrorCode.UNAUTHORIZED,
      message,
      httpStatus: HttpStatus.UNAUTHORIZED,
    });
  }

  static forbidden(message = 'Invalid API key'): AppException {
    return new AppException({
      code: ErrorCode.FORBIDDEN,
      message,
      httpStatus: HttpStatus.FORBIDDEN,
    });
  }

  static rateLimited(details?: Record<string, unknown>): AppException {
    return new AppException({
      code: ErrorCode.RATE_LIMITED,
      message: '请求过于频繁，请稍后再试。',
      httpStatus: HttpStatus.TOO_MANY_REQUESTS,
      details,
    });
  }

  static costLimitExceeded(): AppException {
    return new AppException({
      code: ErrorCode.COST_LIMIT_EXCEEDED,
      message: '本项目已达到成本上限，请调整预算后重试。',
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
    });
  }

  static internal(
    message = 'Internal server error',
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
  ): AppException {
    return new AppException({ code, message, httpStatus: HttpStatus.INTERNAL_SERVER_ERROR });
  }
}

interface AppExceptionInput {
  readonly code: ErrorCode;
  readonly message: string;
  readonly httpStatus: HttpStatus;
  readonly details?: Record<string, unknown>;
}
