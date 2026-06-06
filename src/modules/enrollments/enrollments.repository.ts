import { Injectable } from '@nestjs/common';
import type {
  CalendarEvent,
  CalendarEventType,
  Course,
  CourseSettings,
  Enrollment,
  EnrollmentStatus,
  EnrollmentType,
  Lesson,
  LessonProgress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type PaginationDto } from '../../common/dto/pagination.dto';

export type CourseWithSettings = Course & { settings: CourseSettings | null };
export type EnrollmentWithProgress = Enrollment & { progress: LessonProgress[] };
export type GradebookCategoryRow = {
  weight: number;
  items: {
    weight: number | null;
    maxScore: number;
    lesson: {
      quizAttempts: { score: number | null }[];
      submissions: { grade: number | null }[];
    };
  }[];
};

export type EnrollmentForCourseView = Enrollment & {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  progress: { completedAt: Date | null }[];
};

export type EnrollmentForUserView = Enrollment & {
  course: {
    title: string;
    coverUrl: string | null;
    enrollmentType: EnrollmentType;
  };
  progress: { completedAt: Date | null }[];
};

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUserId(
    userId: string,
    pagination: PaginationDto,
    status?: EnrollmentStatus,
    courseId?: string,
  ): Promise<[Enrollment[], number]> {
    const where = { userId, ...(status && { status }), ...(courseId && { courseId }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit ?? 20,
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    return [data, total];
  }

  async findManyByCourseId(
    courseId: string,
    pagination: PaginationDto,
  ): Promise<[Enrollment[], number]> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where: { courseId },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.enrollment.count({ where: { courseId } }),
    ]);
    return [data, total];
  }

  findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  }

  findById(id: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { id } });
  }

  findByIdWithProgress(id: string): Promise<EnrollmentWithProgress | null> {
    return this.prisma.enrollment.findUnique({
      where: { id },
      include: { progress: true },
    });
  }

  findCourseWithSettings(courseId: string): Promise<CourseWithSettings | null> {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      include: { settings: true },
    });
  }

  findPublishedLessons(courseId: string): Promise<Lesson[]> {
    return this.prisma.lesson.findMany({
      where: { module: { courseId }, isPublished: true },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
    });
  }

  countActiveByCourseId(courseId: string): Promise<number> {
    return this.prisma.enrollment.count({ where: { courseId, status: 'ACTIVE' } });
  }

  async createWithProgress(params: {
    userId: string;
    courseId: string;
    lessons: Lesson[];
    lockAll: boolean;
    isSequential: boolean;
  }): Promise<Enrollment> {
    const { userId, courseId, lessons, lockAll, isSequential } = params;
    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({ data: { userId, courseId } });
      if (lessons.length > 0) {
        await tx.lessonProgress.createMany({
          data: lessons.map((lesson, index) => ({
            enrollmentId: enrollment.id,
            lessonId: lesson.id,
            isLocked: lockAll || (isSequential && index > 0),
          })),
        });
      }
      return enrollment;
    });
  }

  async reactivateWithProgress(params: {
    enrollmentId: string;
    lessons: Lesson[];
    lockAll: boolean;
    isSequential: boolean;
  }): Promise<Enrollment> {
    const { enrollmentId, lessons, lockAll, isSequential } = params;
    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'ACTIVE', completedAt: null, enrolledAt: new Date() },
      });
      await tx.lessonProgress.deleteMany({ where: { enrollmentId } });
      if (lessons.length > 0) {
        await tx.lessonProgress.createMany({
          data: lessons.map((lesson, index) => ({
            enrollmentId,
            lessonId: lesson.id,
            isLocked: lockAll || (isSequential && index > 0),
          })),
        });
      }
      return enrollment;
    });
  }

  findActiveByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findFirst({ where: { userId, courseId, status: 'ACTIVE' } });
  }

  updateStatus(id: string, status: EnrollmentStatus, completedAt?: Date): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status, ...(completedAt !== undefined && { completedAt }) },
    });
  }

  countPublishedLessons(courseId: string): Promise<number> {
    return this.prisma.lesson.count({ where: { module: { courseId }, isPublished: true } });
  }

  countCompletedLessons(enrollmentId: string): Promise<number> {
    return this.prisma.lessonProgress.count({
      where: { enrollmentId, completedAt: { not: null } },
    });
  }

  findGradebookData(courseId: string, enrollmentId: string): Promise<GradebookCategoryRow[]> {
    return this.prisma.gradebookCategory.findMany({
      where: { courseId },
      select: {
        weight: true,
        items: {
          select: {
            weight: true,
            maxScore: true,
            lesson: {
              select: {
                quizAttempts: {
                  where: { enrollmentId },
                  orderBy: { score: 'desc' },
                  take: 1,
                  select: { score: true },
                },
                submissions: {
                  where: { enrollmentId, grade: { not: null } },
                  orderBy: { submittedAt: 'desc' },
                  take: 1,
                  select: { grade: true },
                },
              },
            },
          },
        },
      },
    });
  }

  updateCompletion(
    enrollmentId: string,
    finalGrade: number | null,
    now: Date,
  ): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        finalGrade,
        gradedAt: finalGrade !== null ? now : null,
      },
    });
  }

  createCalendarEvent(data: {
    userId: string;
    courseId: string;
    title: string;
    type: CalendarEventType;
    startDate: Date;
    allDay: boolean;
    referenceId: string;
    referenceType: string;
  }): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.create({ data });
  }

  async findManyByCourseIdWithUser(
    courseId: string,
    pagination: PaginationDto,
  ): Promise<[EnrollmentForCourseView[], number]> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where: { courseId },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
        orderBy: { enrolledAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          progress: { select: { completedAt: true } },
        },
      }),
      this.prisma.enrollment.count({ where: { courseId } }),
    ]);
    return [data, total];
  }

  async findManyByUserIdWithCourse(
    userId: string,
    pagination: PaginationDto,
  ): Promise<[EnrollmentForUserView[], number]> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
        orderBy: { enrolledAt: 'desc' },
        include: {
          course: { select: { title: true, coverUrl: true, enrollmentType: true } },
          progress: { select: { completedAt: true } },
        },
      }),
      this.prisma.enrollment.count({ where: { userId } }),
    ]);
    return [data, total];
  }

  async bulkCreateWithProgress(params: {
    userIds: string[];
    courseId: string;
    lessons: Lesson[];
  }): Promise<{ enrolled: number; skipped: number; failed: number }> {
    const uniqueIds = [...new Set(params.userIds)];

    const existingUsers = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const validSet = new Set(existingUsers.map((u) => u.id));
    const failed = uniqueIds.filter((id) => !validSet.has(id)).length;
    const validIds = uniqueIds.filter((id) => validSet.has(id));

    if (validIds.length === 0) {
      return { enrolled: 0, skipped: 0, failed };
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const existingEnrollments = await tx.enrollment.findMany({
        where: {
          userId: { in: validIds },
          courseId: params.courseId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
        },
        select: { userId: true },
      });
      const skipSet = new Set(existingEnrollments.map((e) => e.userId));
      const toProcess = validIds.filter((id) => !skipSet.has(id));

      if (toProcess.length === 0) {
        return { enrolled: 0, skipped: skipSet.size };
      }

      await tx.enrollment.updateMany({
        where: {
          userId: { in: toProcess },
          courseId: params.courseId,
          status: 'CANCELLED',
        },
        data: { status: 'ACTIVE', completedAt: null },
      });

      await tx.enrollment.createMany({
        data: toProcess.map((userId) => ({ userId, courseId: params.courseId })),
        skipDuplicates: true,
      });

      const enrollments = await tx.enrollment.findMany({
        where: { userId: { in: toProcess }, courseId: params.courseId },
        select: { id: true },
      });

      if (params.lessons.length > 0 && enrollments.length > 0) {
        await tx.lessonProgress.deleteMany({
          where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
        });
        await tx.lessonProgress.createMany({
          data: enrollments.flatMap((e) =>
            params.lessons.map((l) => ({ enrollmentId: e.id, lessonId: l.id })),
          ),
        });
      }

      return { enrolled: toProcess.length, skipped: skipSet.size };
    });

    return { ...transactionResult, failed };
  }

  deleteByUserAndCourse(userId: string, courseId: string): Promise<Enrollment> {
    return this.prisma.enrollment.delete({ where: { userId_courseId: { userId, courseId } } });
  }
}
