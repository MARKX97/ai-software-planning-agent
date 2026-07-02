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

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, httpStatus);
    this.code = code;
    this.details = details;
  }

  static badRequest(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AppException {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static notFound(code: ErrorCode, message: string): AppException {
    return new AppException(code, message, HttpStatus.NOT_FOUND);
  }

  static conflict(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): AppException {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'Invalid API key'): AppException {
    return new AppException(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static internal(message = 'Internal server error'): AppException {
    return new AppException(ErrorCode.INTERNAL_ERROR, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
