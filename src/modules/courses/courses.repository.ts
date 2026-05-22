import { Injectable } from '@nestjs/common';
import type { Course, CourseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindCoursesParams {
  status?: CourseStatus;
  instructorId?: string;
  categoryId?: string;
  skip?: number;
  take?: number;
}

export type CourseWithCount = Course & {
  lessonsCount: number;
  enrollmentsCount: number;
};

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: FindCoursesParams): Promise<[Course[], number]> {
    const where: Prisma.CourseWhereInput = {
      ...(params.status && { status: params.status }),
      ...(params.instructorId && { instructorId: params.instructorId }),
      ...(params.categoryId && { categoryId: params.categoryId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);
    return [data, total];
  }

  findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { id } });
  }

  async findByIdWithCount(id: string): Promise<CourseWithCount | null> {
    const [course, lessonsCount] = await Promise.all([
      this.prisma.course.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      }),
      this.prisma.lesson.count({ where: { module: { courseId: id } } }),
    ]);
    if (!course) return null;
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      price: course.price,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      lessonsCount,
      enrollmentsCount: course._count.enrollments,
    };
  }

  findBySlug(slug: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { slug } });
  }

  countNonCancelledEnrollments(courseId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { courseId, status: { not: 'CANCELLED' } },
    });
  }

  countLessons(courseId: string): Promise<number> {
    return this.prisma.lesson.count({ where: { module: { courseId } } });
  }

  create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }
}
