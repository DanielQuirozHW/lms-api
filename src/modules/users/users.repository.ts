import { Injectable } from '@nestjs/common';
import type { LoginEvent, Prisma, User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
}
