import { Injectable } from '@nestjs/common';
import { type CourseRating, RatingScale } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationDto } from '../../common/dto/pagination.dto';

export type CourseRatingSettings = {
  instructorId: string;
  settings: { ratingEnabled: boolean; ratingScale: RatingScale } | null;
};

@Injectable()
export class RatingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCourseRatingSettings(courseId: string): Promise<CourseRatingSettings | null> {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructorId: true,
        settings: { select: { ratingEnabled: true, ratingScale: true } },
      },
    });
  }

  findByUserAndCourse(userId: string, courseId: string): Promise<CourseRating | null> {
    return this.prisma.courseRating.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  async findMany(courseId: string, pagination: PaginationDto): Promise<[CourseRating[], number]> {
    const where = { courseId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.courseRating.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
      }),
      this.prisma.courseRating.count({ where }),
    ]);
    return [data, total];
  }

  create(data: {
    userId: string;
    courseId: string;
    score: number;
    review?: string;
  }): Promise<CourseRating> {
    return this.prisma.courseRating.create({ data });
  }

  update(
    userId: string,
    courseId: string,
    data: { score?: number; review?: string },
  ): Promise<CourseRating> {
    return this.prisma.courseRating.update({
      where: { userId_courseId: { userId, courseId } },
      data,
    });
  }

  async getSummary(courseId: string): Promise<{ avg: number | null; count: number }> {
    const result = await this.prisma.courseRating.aggregate({
      where: { courseId },
      _avg: { score: true },
      _count: { id: true },
    });
    return { avg: result._avg.score, count: result._count.id };
  }
}
