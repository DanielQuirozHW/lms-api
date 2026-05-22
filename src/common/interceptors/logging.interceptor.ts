import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, url } = req;
    const requestId = randomUUID();
    const start = Date.now();

    res.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${url} ${String(res.statusCode)} +${String(duration)}ms [${requestId}]`,
          );
        },
        error: (err: unknown) => {
          const duration = Date.now() - start;
          const status = err instanceof HttpException ? err.getStatus() : 500;
          this.logger.error(
            `${method} ${url} ${String(status)} +${String(duration)}ms [${requestId}]`,
          );
        },
      }),
    );
  }
}
