import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EnrollmentStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { AuthService } from '../auth/auth.service';
import type { AuthResponseDto } from '../auth/dto/auth-response.dto';
import type { AdminStatsDto } from './dto/admin-stats.dto';
import type { StopImpersonationDto } from './dto/stop-impersonation.dto';
import { ImpersonationLogService } from './impersonation.log.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AuthService,
    private readonly logService: ImpersonationLogService,
    private readonly prisma: PrismaService,
  ) {}

  /** Returns platform-wide aggregate counts for the admin dashboard. */
  async getStats(): Promise<AdminStatsDto> {
    const [totalUsers, totalCourses, totalEnrollments, activeEnrollments, completedEnrollments] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.course.count(),
        this.prisma.enrollment.count(),
        this.prisma.enrollment.count({ where: { status: EnrollmentStatus.ACTIVE } }),
        this.prisma.enrollment.count({ where: { status: EnrollmentStatus.COMPLETED } }),
      ]);
    return { totalUsers, totalCourses, totalEnrollments, activeEnrollments, completedEnrollments };
  }

  /**
   * Issues a 60-minute impersonation token pair for the target user.
   * Guards:
   * - Cannot impersonate yourself.
   * - Cannot impersonate an ADMIN (privilege escalation risk).
   * - Cannot start a new impersonation while already in one (nested impersonation).
   */
  async startImpersonation(
    admin: AuthenticatedUser,
    targetUserId: string,
  ): Promise<AuthResponseDto> {
    if (admin.impersonatedBy) {
      throw new ForbiddenException(
        'Cannot start an impersonation session while already impersonating',
      );
    }
    if (admin.id === targetUserId) {
      throw new BadRequestException('You cannot impersonate yourself');
    }

    const target = await this.authService.findUserByIdOrFail(targetUserId);

    if (target.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Cannot impersonate an ADMIN user');
    }

    const result = await this.authService.issueImpersonationTokens(admin.id, target);

    this.logService.logImpersonationStart(admin.id, targetUserId, result.impersonationTokenId);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    };
  }

  /**
   * Revokes the current impersonation token and re-issues fresh tokens for the original admin.
   * Validates that the current session is actually an impersonation token before proceeding.
   */
  async stopImpersonation(
    user: AuthenticatedUser,
    dto: StopImpersonationDto,
  ): Promise<AuthResponseDto> {
    if (!user.impersonatedBy || !user.impersonationTokenId) {
      throw new BadRequestException('No active impersonation session');
    }

    // The JWT's impersonatedBy is the authoritative source — reject mismatched body values.
    if (user.impersonatedBy !== dto.adminId) {
      throw new BadRequestException('adminId does not match the active impersonation session');
    }

    await this.authService.revokeImpersonationToken(user.impersonationTokenId);

    this.logService.logImpersonationStop(user.impersonatedBy, user.id, user.impersonationTokenId);

    return this.authService.resumeAdminSession(user.impersonatedBy);
  }
}
