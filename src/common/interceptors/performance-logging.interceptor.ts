import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class PerformanceLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.originalUrl || request.url;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(method, url, startedAt),
        error: () => this.logRequest(method, url, startedAt),
      }),
    );
  }

  private logRequest(method: string, url: string, startedAt: number): void {
    this.logger.log(`${method} ${url} Total: ${Date.now() - startedAt}ms`);
  }
}
