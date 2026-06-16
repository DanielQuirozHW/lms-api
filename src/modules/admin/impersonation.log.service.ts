import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Structured audit log for impersonation events.
 * Writes to both the NestJS logger and the impersonation_logs DB table.
 * DB writes are fire-and-forget — a log failure never blocks the main operation.
 */
@Injectable()
export class ImpersonationLogService {
  private readonly logger = new Logger('ImpersonationAudit');

  constructor(private readonly prisma: PrismaService) {}

  logImpersonationStart(adminId: string, targetUserId: string, impersonationTokenId: string): void {
    this.logger.log(
      JSON.stringify({
        action: 'IMPERSONATION_START',
        adminId,
        targetUserId,
        impersonationTokenId,
        timestamp: new Date().toISOString(),
      }),
    );
    void this.prisma.impersonationLog
      .create({ data: { adminId, targetUserId } })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to persist impersonation start log: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  logImpersonationStop(adminId: string, targetUserId: string, impersonationTokenId: string): void {
    this.logger.log(
      JSON.stringify({
        action: 'IMPERSONATION_STOP',
        adminId,
        targetUserId,
        impersonationTokenId,
        timestamp: new Date().toISOString(),
      }),
    );
    void this.prisma.impersonationLog
      .findFirst({
        where: { adminId, targetUserId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
      .then((record) => {
        if (!record) {
          this.logger.warn(
            `No active impersonation log found for admin ${adminId}, target ${targetUserId}`,
          );
          return;
        }
        return this.prisma.impersonationLog.update({
          where: { id: record.id },
          data: { endedAt: new Date() },
        });
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Failed to persist impersonation stop log: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
