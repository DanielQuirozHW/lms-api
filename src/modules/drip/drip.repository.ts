import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type DripModuleInfo = {
  id: string;
  title: string;
  unlockAfterDays: number | null;
  lessons: { id: string }[];
};

export type DripEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date;
  course: {
    modules: DripModuleInfo[];
  };
};

@Injectable()
export class DripRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveEnrollmentsWithDripModules(): Promise<DripEnrollment[]> {
    return this.prisma.enrollment.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        courseId: true,
        enrolledAt: true,
        course: {
          select: {
            modules: {
              where: { unlockAfterDays: { not: null }, isPublished: true },
              select: {
                id: true,
                title: true,
                unlockAfterDays: true,
                lessons: {
                  where: { isPublished: true },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async unlockModuleLessons(enrollmentId: string, lessonIds: string[]): Promise<number> {
    const result = await this.prisma.lessonProgress.updateMany({
      where: { enrollmentId, lessonId: { in: lessonIds }, isLocked: true },
      data: { isLocked: false },
    });
    return result.count;
  }
}
