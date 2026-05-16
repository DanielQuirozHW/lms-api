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
  _count: { lessons: number; enrollments: number };
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

  findByIdWithCount(id: string): Promise<CourseWithCount | null> {
    return this.prisma.course.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true, enrollments: true } } },
    });
  }

  findBySlug(slug: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { slug } });
  }

  countActiveEnrollments(courseId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { courseId, status: 'ACTIVE' },
    });
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
