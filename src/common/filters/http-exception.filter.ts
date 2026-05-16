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
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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

    const body: ErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
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
