import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Enrollment } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type {
  EnrollmentDetailResponseDto,
  EnrollmentResponseDto,
  ProgressSummaryDto,
} from './dto/enrollment-response.dto';
import { type EnrollmentWithProgress, EnrollmentsRepository } from './enrollments.repository';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly coursesService: CoursesService,
  ) {}

  /** Enrolls a user in a published course. Validates status, window, and capacity. Seeds LessonProgress records. */
  async enroll(userId: string, dto: CreateEnrollmentDto): Promise<EnrollmentResponseDto> {
    const existing = await this.enrollmentsRepository.findByUserAndCourse(userId, dto.courseId);
    if (existing) throw new ConflictException('Already enrolled in this course');

    const course = await this.enrollmentsRepository.findCourseWithSettings(dto.courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (course.status !== 'PUBLISHED') {
      throw new BadRequestException('Course is not available for enrollment');
    }

    const now = new Date();
    const settings = course.settings;

    if (settings?.enrollmentStartDate && now < settings.enrollmentStartDate) {
      throw new BadRequestException('Enrollment has not started yet');
    }
    if (settings?.enrollmentEndDate && now > settings.enrollmentEndDate) {
      throw new BadRequestException('Enrollment period has ended');
    }

    if (settings?.maxEnrollments != null) {
      const activeCount = await this.enrollmentsRepository.countActiveByCourseId(dto.courseId);
      if (activeCount >= settings.maxEnrollments) {
        throw new ConflictException('Course enrollment limit has been reached');
      }
    }

    const lessons = await this.enrollmentsRepository.findPublishedLessons(dto.courseId);
    const lockAll = !!(settings?.courseStartDate && settings.courseStartDate > now);
    const isSequential = settings?.isSequential ?? false;

    const enrollment = await this.enrollmentsRepository.createWithProgress({
      userId,
      courseId: dto.courseId,
      lessons,
      lockAll,
      isSequential,
    });

    return this.map(enrollment);
  }

  /** Returns the authenticated user's own enrollments, paginated. */
  async findMyEnrollments(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<EnrollmentResponseDto>> {
    const [enrollments, total] = await this.enrollmentsRepository.findManyByUserId(
      userId,
      pagination,
    );
    return paginate(
      enrollments.map((e) => this.map(e)),
      total,
      pagination,
    );
  }

  /** Returns enrollment detail with progress summary. Only the enrolled user or admin may access. */
  async findOne(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<EnrollmentDetailResponseDto> {
    const enrollment = await this.enrollmentsRepository.findByIdWithProgress(id);
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (!isAdmin && enrollment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this enrollment');
    }

    return {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      completedAt: enrollment.completedAt,
      enrolledAt: enrollment.enrolledAt,
      updatedAt: enrollment.updatedAt,
      progress: this.buildProgress(enrollment),
    };
  }

  /** Cancels an enrollment. Students can cancel their own; admins can cancel any. Cannot cancel COMPLETED. */
  async cancel(id: string, userId: string, isAdmin: boolean): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findById(id);
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (!isAdmin && enrollment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this enrollment');
    }

    if (enrollment.status === 'COMPLETED') {
      throw new ConflictException('Cannot cancel a completed enrollment');
    }

    await this.enrollmentsRepository.updateStatus(id, 'CANCELLED');
  }

  /** Returns all enrollments for a course. Instructor must own the course; admin can access any. */
  async getByCourseId(
    courseId: string,
    user: AuthenticatedUser,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<EnrollmentResponseDto>> {
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin) {
      const course = await this.coursesService.findOne(courseId);
      if (course.instructorId !== user.id) {
        throw new ForbiddenException('You do not own this course');
      }
    }

    const [enrollments, total] = await this.enrollmentsRepository.findManyByCourseId(
      courseId,
      pagination,
    );
    return paginate(
      enrollments.map((e) => this.map(e)),
      total,
      pagination,
    );
  }

  /** Returns true when the user has an active enrollment in the course. */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const e = await this.enrollmentsRepository.findActiveByUserAndCourse(userId, courseId);
    return e !== null;
  }

  /** Manually marks an active enrollment as completed (admin only). */
  async complete(id: string): Promise<EnrollmentResponseDto> {
    const enrollment = await this.enrollmentsRepository.findById(id);
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (enrollment.status !== 'ACTIVE') {
      throw new ConflictException('Only active enrollments can be marked as completed');
    }

    const updated = await this.enrollmentsRepository.updateStatus(id, 'COMPLETED', new Date());
    return this.map(updated);
  }

  private map(enrollment: Enrollment): EnrollmentResponseDto {
    return {
      id: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      status: enrollment.status,
      completedAt: enrollment.completedAt,
      enrolledAt: enrollment.enrolledAt,
      updatedAt: enrollment.updatedAt,
    };
  }

  private buildProgress(enrollment: EnrollmentWithProgress): ProgressSummaryDto {
    const total = enrollment.progress.length;
    const completed = enrollment.progress.filter((p) => p.completedAt !== null).length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    return { totalLessons: total, completedLessons: completed, progressPercentage };
  }
}
