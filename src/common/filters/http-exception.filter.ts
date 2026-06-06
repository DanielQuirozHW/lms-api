import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/auth.entity';
import type { ErrorLogService } from '../../modules/error-log/error-log.service';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

const PRISMA_ERROR_MAP: Partial<Record<string, () => HttpException>> = {
  P2002: () => new ConflictException('A record with that value already exists'),
  P2025: () => new NotFoundException('Record not found'),
  P2003: () => new BadRequestException('Related record not found'),
};

const BODY_LOG_MAX_LEN = 500;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Optional() private readonly errorLogService?: ErrorLogService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.mapException(exception);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (mapped instanceof HttpException) {
      status = mapped.getStatus();
      const exceptionResponse = mapped.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = mapped.message;
      } else {
        const body = exceptionResponse as Record<string, unknown>;
        const rawMessage = body['message'];
        const rawError = body['error'];

        if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else if (Array.isArray(rawMessage)) {
          message = rawMessage.filter((item: unknown): item is string => typeof item === 'string');
        }

        if (typeof rawError === 'string') {
          error = rawError;
        }
      }
    } else if (mapped instanceof Error) {
      this.logger.error(mapped.message, mapped.stack);
    }

    // Persist 5xx errors to the system_errors table for admin review.
    // Uses request.path (not request.url) per MISTAKES.md [009] — query strings may carry tokens or PII.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR && this.errorLogService) {
      const exc = mapped instanceof Error ? mapped : exception instanceof Error ? exception : null;
      const rawBody = request.body as unknown;
      let bodyStr: string | undefined;
      try {
        const full = JSON.stringify(rawBody);
        bodyStr = full.length > BODY_LOG_MAX_LEN ? full.slice(0, BODY_LOG_MAX_LEN) : full;
      } catch {
        bodyStr = undefined;
      }
      // request.user is typed loosely by Express; double-cast via unknown to satisfy no-unsafe-assignment
      const authedUser = request.user as unknown as AuthenticatedUser | undefined;
      void this.errorLogService.log({
        message: exc?.message ?? String(exception),
        stack: exc?.stack,
        url: request.path,
        method: request.method,
        statusCode: status,
        userId: authedUser?.id ?? null,
        body: bodyStr,
      });
    }

    const responseBody: ErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.path,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(responseBody);
  }

  private mapException(exception: unknown): unknown {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const factory = PRISMA_ERROR_MAP[exception.code];
      if (factory) return factory();
      this.logger.error(`Unhandled Prisma error ${exception.code}`, exception.message);
    }
    return exception;
  }
}
