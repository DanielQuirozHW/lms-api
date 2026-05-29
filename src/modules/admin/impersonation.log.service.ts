import { Injectable, Logger } from '@nestjs/common';

/**
 * Structured audit log for impersonation events.
 * Currently writes to the NestJS logger. In production replace with an
 * append-only audit-log store (dedicated DB table, CloudWatch Logs, etc.).
 */
@Injectable()
export class ImpersonationLogService {
  private readonly logger = new Logger('ImpersonationAudit');

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
  }
}
