import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { RedisService } from '../../redis/redis.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { LastActiveLessonResponseDto } from './dto/last-active-lesson-response.dto';
import type { LoginEventResponseDto } from './dto/login-event-response.dto';
import type { OverallProgressResponseDto } from './dto/overall-progress-response.dto';
import type { StreakResponseDto } from './dto/streak-response.dto';
import type { UserPrivateResponseDto, UserPublicResponseDto } from './dto/user-response.dto';
import type { WeeklyActivityResponseDto } from './dto/weekly-activity-response.dto';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 12;
// Matches the JWT_EXPIRES_IN default (7d). The revocation key must outlive any valid access token.
const ACCESS_TOKEN_REVOCATION_TTL = 7 * 24 * 60 * 60;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redisService: RedisService,
  ) {}

  /** Returns the full private profile of the authenticated user. */
  async getProfile(userId: string): Promise<UserPrivateResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toPrivate(user);
  }

  /** Updates firstName, lastName, and/or avatarUrl. Prisma P2025 → 404 if the user was deleted mid-session. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserPrivateResponseDto> {
    const user = await this.usersRepository.update(userId, dto);
    return this.toPrivate(user);
  }

  /** Verifies the current password before setting the new one. Revokes all active refresh tokens. Throws 401 on wrong current password. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      this.logger.warn(`Password change failed for user ${userId} — wrong current password`);
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.update(userId, { passwordHash, passwordChangedAt: new Date() });

    const jtis = await this.redisService.smembers(`rt-set:${userId}`);
    if (jtis.length > 0) {
      const rtKeys = jtis.map((jti) => `rt:${userId}:${jti}`);
      await this.redisService.del(...rtKeys, `rt-set:${userId}`);
    }

    await this.redisService.set(`revoked:user:${userId}`, '1', 'EX', ACCESS_TOKEN_REVOCATION_TTL);
    this.logger.log(`Password changed for user ${userId} — all refresh tokens revoked`);
  }

  /** Verifies password, revokes all refresh tokens in Redis, then permanently deletes the account. */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Password is incorrect');

    await this.usersRepository.delete(userId);

    const jtis = await this.redisService.smembers(`rt-set:${userId}`);
    if (jtis.length > 0) {
      const rtKeys = jtis.map((jti) => `rt:${userId}:${jti}`);
      await this.redisService.del(...rtKeys, `rt-set:${userId}`);
    }

    await this.redisService.set(`revoked:user:${userId}`, '1', 'EX', ACCESS_TOKEN_REVOCATION_TTL);
  }

  /** Returns last 7 days of lesson completion activity grouped by day. Day labels in Spanish. */
  async getWeeklyActivity(userId: string): Promise<WeeklyActivityResponseDto> {
    const now = new Date();
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 6);
    since.setUTCHours(0, 0, 0, 0);

    const records = await this.usersRepository.findCompletedLessonsSince(userId, since);

    // L M M J V S D — indexed by getUTCDay() where 0 = Sunday
    const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    // Build ordered 7-day array (oldest first)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      return {
        date: d.toISOString().slice(0, 10),
        dayLabel: DAY_LABELS[d.getUTCDay()],
        completedLessons: 0,
        minutesWatched: 0,
      };
    });

    const dateIndex = new Map(days.map((day, i) => [day.date, i]));

    for (const record of records) {
      if (!record.completedAt) continue;
      const dateStr = record.completedAt.toISOString().slice(0, 10);
      const idx = dateIndex.get(dateStr);
      if (idx !== undefined) {
        days[idx].completedLessons++;
        days[idx].minutesWatched += record.watchedSeconds
          ? Math.floor(record.watchedSeconds / 60)
          : 0;
      }
    }

    return {
      days,
      totalMinutesThisWeek: days.reduce((sum, d) => sum + d.minutesWatched, 0),
      totalLessonsThisWeek: days.reduce((sum, d) => sum + d.completedLessons, 0),
    };
  }

  /** Returns the last 10 login events for the authenticated user. */
  async getLoginHistory(userId: string): Promise<LoginEventResponseDto[]> {
    const events = await this.usersRepository.findLoginHistory(userId);
    return events.map((e) => ({
      id: e.id,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      createdAt: e.createdAt,
    }));
  }

  /** Returns currentStreak and longestStreak based on UTC lesson completion dates. */
  async getStreak(userId: string): Promise<StreakResponseDto> {
    const dates = await this.usersRepository.findAllCompletedDates(userId);

    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const dateSet = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
    const sorted = Array.from(dateSet).sort();

    let longestStreak = 1;
    let runLength = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T00:00:00Z');
      const curr = new Date(sorted[i] + 'T00:00:00Z');
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        runLength++;
        if (runLength > longestStreak) longestStreak = runLength;
      } else {
        runLength = 1;
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let currentStreak = 0;
    if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
      const startStr = dateSet.has(todayStr) ? todayStr : yesterdayStr;
      let checkDate = new Date(startStr + 'T00:00:00Z');
      while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak++;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    return { currentStreak, longestStreak };
  }

  /** Returns the most recently watched lesson across all enrollments, or throws 404 if none. */
  async getLastActiveLesson(userId: string): Promise<LastActiveLessonResponseDto> {
    const record = await this.usersRepository.findLastWatchedLesson(userId);
    if (!record || !record.lastWatchedAt) {
      throw new NotFoundException('No lesson activity found');
    }
    return {
      lessonId: record.lessonId,
      moduleId: record.lesson.moduleId,
      courseId: record.enrollment.courseId,
      courseSlug: record.enrollment.course.slug,
      lastWatchedAt: record.lastWatchedAt,
    };
  }

  /** Returns aggregate lesson completion stats across all active enrollments. */
  async getOverallProgress(userId: string): Promise<OverallProgressResponseDto> {
    const { totalLessons, completedLessons } =
      await this.usersRepository.findOverallProgressStats(userId);
    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 1000) / 10 : 0;
    return { totalLessons, completedLessons, progressPercentage };
  }

  /** Returns the public profile of any user. Never includes email, passwordHash, roles, or isVerified. */
  async getPublicProfile(id: string): Promise<UserPublicResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  /** Updates the role of a target user. Cannot set ADMIN role via this endpoint — admins are provisioned directly. Cannot demote yourself or the last admin account. */
  async updateRole(
    userId: string,
    role: UserRole,
    requestingUserId: string,
  ): Promise<UserPrivateResponseDto> {
    if (role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot assign ADMIN role via this endpoint');
    }
    if (userId === requestingUserId) {
      throw new BadRequestException('You cannot change your own role');
    }
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.roles.includes(UserRole.ADMIN)) {
      const adminCount = await this.usersRepository.countAdmins();
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot change the role of the last admin account');
      }
    }

    const updated = await this.usersRepository.update(userId, { roles: [role] });
    return this.toPrivate(updated);
  }

  /** Returns a paginated list of all users. Admin only. */
  async getAllUsers(pagination: PaginationDto): Promise<PaginatedResult<UserPrivateResponseDto>> {
    const [users, total] = await this.usersRepository.findAll(
      pagination.skip,
      pagination.limit ?? 20,
    );
    return paginate(
      users.map((u) => this.toPrivate(u)),
      total,
      pagination,
    );
  }

  private toPrivate(user: User): UserPrivateResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
      phone: user.phone,
      birthDate: user.birthDate,
      location: user.location,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toPublic(user: User): UserPublicResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }
}
