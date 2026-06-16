import { Injectable } from '@nestjs/common';
import type { EnrollmentCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EnrollmentCodesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    courseId: string;
    code: string;
    maxUses?: number | null;
    expiresAt?: Date | null;
  }): Promise<EnrollmentCode> {
    return this.prisma.enrollmentCode.create({ data });
  }

  findByCourseId(courseId: string): Promise<EnrollmentCode[]> {
    return this.prisma.enrollmentCode.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<EnrollmentCode | null> {
    return this.prisma.enrollmentCode.findUnique({ where: { id } });
  }

  /** Returns the code only when it is active, not expired, and has uses remaining. */
  async findValidCode(code: string, courseId: string): Promise<EnrollmentCode | null> {
    const now = new Date();
    const record = await this.prisma.enrollmentCode.findFirst({
      where: {
        code,
        courseId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!record) return null;
    if (record.maxUses !== null && record.usedCount >= record.maxUses) return null;
    return record;
  }

  async incrementUsage(id: string): Promise<void> {
    await this.prisma.enrollmentCode.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });
  }

  async recordUsage(codeId: string, userId: string): Promise<void> {
    await this.prisma.enrollmentCodeUsage.create({ data: { codeId, userId } });
  }

  deactivate(id: string): Promise<EnrollmentCode> {
    return this.prisma.enrollmentCode.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
