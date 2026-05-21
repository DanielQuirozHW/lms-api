import { Injectable } from '@nestjs/common';
import type {
  Course,
  CourseSettings,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonProgress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type PaginationDto } from '../../common/dto/pagination.dto';

export type CourseWithSettings = Course & { settings: CourseSettings | null };
export type EnrollmentWithProgress = Enrollment & { progress: LessonProgress[] };

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByUserId(
    userId: string,
    pagination: PaginationDto,
  ): Promise<[Enrollment[], number]> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
        orderBy: { enrolledAt: 'desc' },
      }),
      this.prisma.enrollment.count({ where: { userId } }),
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

  findActiveByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findFirst({ where: { userId, courseId, status: 'ACTIVE' } });
  }

  updateStatus(id: string, status: EnrollmentStatus, completedAt?: Date): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status, ...(completedAt !== undefined && { completedAt }) },
    });
  }
}
