import { Injectable } from '@nestjs/common';
import type { Enrollment, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({ where: { userId }, orderBy: { enrolledAt: 'desc' } });
  }

  findByCourseId(courseId: string): Promise<Enrollment[]> {
    return this.prisma.enrollment.findMany({ where: { courseId } });
  }

  findByUserAndCourse(userId: string, courseId: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  }

  findById(id: string): Promise<Enrollment | null> {
    return this.prisma.enrollment.findUnique({ where: { id } });
  }

  create(data: { userId: string; courseId: string }): Promise<Enrollment> {
    return this.prisma.enrollment.create({ data });
  }

  updateStatus(id: string, status: EnrollmentStatus, completedAt?: Date): Promise<Enrollment> {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status, ...(completedAt && { completedAt }) },
    });
  }
}
