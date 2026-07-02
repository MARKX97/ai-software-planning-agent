import { type ArgumentMetadata, type PipeTransform, Injectable } from '@nestjs/common';
import { type ZodType } from 'zod';
import { AppException } from '../exception/app-exception.js';
import { ErrorCode } from '../exception/error-code.js';

/**
 * Generic Zod validation pipe. Throws {@link AppException}(INVALID_INPUT, 400)
 * on parse failure so the global filter renders the unified error shape.
 *
 * @internal
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Method-scoped pipes run on every argument (params, query, body). Only
    // validate query/body payloads; path params arrive as strings and would
    // fail object schemas. Route handlers that need param validation do it
    // explicitly (e.g. UUID via Prisma lookups).
    if (metadata.type !== 'query' && metadata.type !== 'body') return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw AppException.badRequest(ErrorCode.INVALID_INPUT, 'Request validation failed', {
        issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }
    return result.data;
  }
}
