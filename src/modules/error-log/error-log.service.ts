import { Injectable, Logger } from '@nestjs/common';
import type { SystemError } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Persists a 5xx or unexpected error to the system_errors table.
   * Intentionally swallows all exceptions — error logging must never crash the app.
   * Only logs statusCode >= 500 or missing statusCode (unhandled, non-HTTP errors).
   * 4xx client errors are ignored.
   */
  async log(data: Partial<SystemError>): Promise<void> {
    const { statusCode } = data;
    if (statusCode !== undefined && statusCode !== null && statusCode < 500) return;

    try {
      await this.prisma.systemError.create({
        data: {
          level: data.level ?? 'ERROR',
          message: data.message ?? 'Unknown error',
          stack: data.stack ?? null,
          url: data.url ?? null,
          method: data.method ?? null,
          statusCode: data.statusCode ?? null,
          userId: data.userId ?? null,
          body: data.body ?? null,
        },
      });
    } catch (err) {
      // Must not throw — log to console as last resort
      this.logger.error(
        'Failed to persist error log entry',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
