import { Injectable } from '@nestjs/common';
import { type Announcement, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationDto } from '../../common/dto/pagination.dto';

export type CourseAccessSettings = {
  instructorId: string;
  settings: { forumPublic: boolean } | null;
};

@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCourseAccessSettings(courseId: string): Promise<CourseAccessSettings | null> {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructorId: true,
        settings: { select: { forumPublic: true } },
      },
    });
  }

  async findMany(courseId: string, pagination: PaginationDto): Promise<[Announcement[], number]> {
    const where = { courseId, isActive: true };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return [data, total];
  }

  findById(id: string): Promise<Announcement | null> {
    return this.prisma.announcement.findFirst({ where: { id, isActive: true } });
  }

  create(data: {
    courseId: string;
    instructorId: string;
    title: string;
    body: string;
  }): Promise<Announcement> {
    return this.prisma.announcement.create({ data });
  }

  update(id: string, data: { title?: string; body?: string }): Promise<Announcement> {
    return this.prisma.announcement.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.announcement.delete({ where: { id } });
  }

  async findEnrolledUserIds(courseId: string): Promise<string[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseId, status: EnrollmentStatus.ACTIVE },
      select: { userId: true },
    });
    return enrollments.map((e) => e.userId);
  }
}
