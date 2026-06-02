import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import type { CreateEnrollmentCodeDto } from './dto/create-enrollment-code.dto';
import type { EnrollmentCodeResponseDto } from './dto/enrollment-code-response.dto';
import { EnrollmentCodesRepository } from './enrollment-codes.repository';

@Injectable()
export class EnrollmentCodesService {
  constructor(
    private readonly enrollmentCodesRepository: EnrollmentCodesRepository,
    private readonly coursesService: CoursesService,
  ) {}

  async create(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateEnrollmentCodeDto,
  ): Promise<EnrollmentCodeResponseDto> {
    await this.verifyCourseOwnership(courseId, user);
    const code = await this.enrollmentCodesRepository.create({
      courseId,
      code: dto.code,
      maxUses: dto.maxUses ?? null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.map(code);
  }

  async findByCourse(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<EnrollmentCodeResponseDto[]> {
    await this.verifyCourseOwnership(courseId, user);
    const codes = await this.enrollmentCodesRepository.findByCourseId(courseId);
    return codes.map((c) => this.map(c));
  }

  async deactivate(courseId: string, id: string, user: AuthenticatedUser): Promise<void> {
    await this.verifyCourseOwnership(courseId, user);
    const code = await this.enrollmentCodesRepository.findById(id);
    if (!code || code.courseId !== courseId) {
      throw new NotFoundException('Enrollment code not found');
    }
    await this.enrollmentCodesRepository.deactivate(id);
  }

  /** Confirms caller is ADMIN or the course's instructor. Uses NotFoundException for BOLA safety. */
  private async verifyCourseOwnership(courseId: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin && course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  private map(code: {
    id: string;
    courseId: string;
    code: string;
    maxUses: number | null;
    usedCount: number;
    expiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
  }): EnrollmentCodeResponseDto {
    return {
      id: code.id,
      courseId: code.courseId,
      code: code.code,
      maxUses: code.maxUses,
      usedCount: code.usedCount,
      expiresAt: code.expiresAt,
      isActive: code.isActive,
      createdAt: code.createdAt,
    };
  }
}
