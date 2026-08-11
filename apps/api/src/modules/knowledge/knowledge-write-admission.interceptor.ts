import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { finalize, type Observable } from 'rxjs';
import { AppException } from '../../common/exception/app-exception.js';
import { MAX_CONCURRENT_KNOWLEDGE_INDEXES } from './knowledge-limits.js';

@Injectable()
export class KnowledgeWriteAdmissionInterceptor implements NestInterceptor {
  private active = 0;

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.active >= MAX_CONCURRENT_KNOWLEDGE_INDEXES) {
      throw AppException.rateLimited({ retry_after_seconds: 1 });
    }
    this.active += 1;
    return next.handle().pipe(finalize(() => (this.active -= 1)));
  }
}
