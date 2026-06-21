import { Injectable } from '@nestjs/common';
import type { Certificate, EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CertificateWithDetails = Certificate & {
  course: {
    title: string;
    slug: string;
    instructor: { firstName: string; lastName: string };
  };
  user: { firstName: string; lastName: string };
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
};

interface EnrollmentProgress {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  progressPercentage: number;
  finalGrade: number | null;
}

@Injectable()
export class CertificatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the enrollment with a computed progress percentage for certificate eligibility checks. */
  async findEnrollmentWithProgress(enrollmentId: string): Promise<EnrollmentProgress | null> {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId } });
    if (!enrollment) return null;

    const [totalLessons, completedLessons] = await Promise.all([
      this.prisma.lesson.count({ where: { module: { courseId: enrollment.courseId } } }),
      this.prisma.lessonProgress.count({
        where: { enrollmentId, completedAt: { not: null } },
      }),
    ]);

    const progressPercentage =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      progressPercentage,
      finalGrade: enrollment.finalGrade,
    };
  }

  /** Creates a certificate or returns the existing one (idempotent by enrollmentId). Restores isActive if previously revoked. */
  upsertByEnrollment(data: {
    userId: string;
    courseId: string;
    enrollmentId: string;
    finalGrade: number | null;
  }): Promise<CertificateWithDetails> {
    return this.prisma.certificate.upsert({
      where: { enrollmentId: data.enrollmentId },
      update: { isActive: true },
      create: {
        userId: data.userId,
        courseId: data.courseId,
        enrollmentId: data.enrollmentId,
        finalGrade: data.finalGrade,
      },
      include: {
        course: {
          select: {
            title: true,
            slug: true,
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  findByUserId(userId: string): Promise<CertificateWithDetails[]> {
    return this.prisma.certificate.findMany({
      where: { userId, isActive: true },
      include: {
        course: {
          select: {
            title: true,
            slug: true,
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByCode(certificateCode: string): Promise<CertificateWithDetails | null> {
    return this.prisma.certificate.findFirst({
      where: { certificateCode, isActive: true },
      include: {
        course: {
          select: {
            title: true,
            slug: true,
            instructor: { select: { firstName: true, lastName: true } },
          },
        },
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /** Soft-deletes the certificate by setting isActive = false. */
  softDelete(id: string): Promise<Certificate> {
    return this.prisma.certificate.update({ where: { id }, data: { isActive: false } });
  }
}
