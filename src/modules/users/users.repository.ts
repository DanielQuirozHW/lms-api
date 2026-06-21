import { Injectable } from '@nestjs/common';
import type { LoginEvent, NotificationPreferences, Prisma, User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface NotificationPreferencesData {
  lessonRemindersEmail?: boolean;
  lessonRemindersPush?: boolean;
  newCoursesEmail?: boolean;
  newCoursesPush?: boolean;
  forumRepliesEmail?: boolean;
  forumRepliesPush?: boolean;
  achievementsEmail?: boolean;
  achievementsPush?: boolean;
  platformNewsEmail?: boolean;
  platformNewsPush?: boolean;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(skip: number, take: number): Promise<[User[], number]> {
    const where = { isActive: true };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return [data, total];
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, isActive: true } });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Soft-deletes the user by setting isActive = false. */
  delete(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  countAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { roles: { has: UserRole.ADMIN }, isActive: true } });
  }

  findCompletedLessonsSince(
    userId: string,
    since: Date,
  ): Promise<Array<{ completedAt: Date | null; watchedSeconds: number | null }>> {
    return this.prisma.lessonProgress.findMany({
      where: {
        enrollment: { userId },
        completedAt: { gte: since },
      },
      select: { completedAt: true, watchedSeconds: true },
    });
  }

  findLoginHistory(userId: string): Promise<LoginEvent[]> {
    return this.prisma.loginEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async findAllCompletedDates(userId: string): Promise<Date[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { enrollment: { userId }, completedAt: { not: null } },
      select: { completedAt: true },
    });
    return rows.map((r) => r.completedAt as Date);
  }

  findLastWatchedLesson(userId: string): Promise<{
    lessonId: string;
    lastWatchedAt: Date | null;
    lesson: { moduleId: string };
    enrollment: { courseId: string; course: { slug: string } };
  } | null> {
    return this.prisma.lessonProgress.findFirst({
      where: { enrollment: { userId }, lastWatchedAt: { not: null } },
      orderBy: { lastWatchedAt: 'desc' },
      select: {
        lessonId: true,
        lastWatchedAt: true,
        lesson: { select: { moduleId: true } },
        enrollment: { select: { courseId: true, course: { select: { slug: true } } } },
      },
    });
  }

  async findOverallProgressStats(
    userId: string,
  ): Promise<{ totalLessons: number; completedLessons: number }> {
    const [totalLessons, completedLessons] = await this.prisma.$transaction([
      this.prisma.lessonProgress.count({
        where: { enrollment: { userId, status: 'ACTIVE' } },
      }),
      this.prisma.lessonProgress.count({
        where: { enrollment: { userId, status: 'ACTIVE' }, completedAt: { not: null } },
      }),
    ]);
    return { totalLessons, completedLessons };
  }

  async findCompletedLessonsByDateRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ date: string; count: number }>> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        enrollment: { userId },
        completedAt: { gte: from, lte: to },
      },
      select: { completedAt: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.completedAt) continue;
      const dateStr = row.completedAt.toISOString().slice(0, 10);
      counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }

  findRecentCompletedLessons(
    userId: string,
    limit: number,
  ): Promise<
    Array<{
      completedAt: Date | null;
      lesson: { title: string; module: { course: { title: string } } };
    }>
  > {
    return this.prisma.lessonProgress.findMany({
      where: { enrollment: { userId }, completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: {
        completedAt: true,
        lesson: {
          select: {
            title: true,
            module: { select: { course: { select: { title: true } } } },
          },
        },
      },
    });
  }

  findRecentCertificates(
    userId: string,
    limit: number,
  ): Promise<Array<{ createdAt: Date; course: { title: string } }>> {
    return this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { createdAt: true, course: { select: { title: true } } },
    });
  }

  findRecentBookmarks(
    userId: string,
    limit: number,
  ): Promise<
    Array<{
      createdAt: Date;
      lesson: { title: string; module: { course: { title: string } } };
    }>
  > {
    return this.prisma.lessonBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        createdAt: true,
        lesson: {
          select: {
            title: true,
            module: { select: { course: { select: { title: true } } } },
          },
        },
      },
    });
  }

  findNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    return this.prisma.notificationPreferences.findUnique({ where: { userId } });
  }

  upsertNotificationPreferences(
    userId: string,
    data: NotificationPreferencesData,
  ): Promise<NotificationPreferences> {
    const defaults: NotificationPreferencesData = {
      lessonRemindersEmail: true,
      lessonRemindersPush: true,
      newCoursesEmail: false,
      newCoursesPush: true,
      forumRepliesEmail: true,
      forumRepliesPush: true,
      achievementsEmail: true,
      achievementsPush: true,
      platformNewsEmail: false,
      platformNewsPush: false,
    };
    return this.prisma.notificationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...defaults, ...data },
    });
  }
}
