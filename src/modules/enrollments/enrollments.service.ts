import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CourseSettings, Enrollment } from '@prisma/client';
import { CalendarEventType, EnrollmentType, NotificationType, UserRole } from '@prisma/client';
import {
  paginate,
  type PaginatedResult,
  type PaginationDto,
} from '../../common/dto/pagination.dto';
import type { QueryEnrollmentDto } from './dto/query-enrollment.dto';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type {
  EnrollmentDetailResponseDto,
  EnrollmentResponseDto,
  ProgressSummaryDto,
} from './dto/enrollment-response.dto';
import type { BulkEnrollDto } from './dto/bulk-enroll.dto';
import type { BulkEnrollResultDto } from './dto/bulk-enroll-result.dto';
import type { UserEnrollmentItemDto } from './dto/user-enrollment-response.dto';
import type { CourseEnrollmentItemDto } from './dto/enrollment-response.dto';
import { EnrollmentCodesRepository } from './enrollment-codes.repository';
import {
  type EnrollmentWithProgress,
  type EnrollmentForCourseView,
  type EnrollmentForUserView,
  EnrollmentsRepository,
} from './enrollments.repository';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly configService: ConfigService<AppConfig>,
    private readonly enrollmentCodesRepository: EnrollmentCodesRepository,
    private readonly coursesService: CoursesService,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Enrolls a user in a published course. Validates verification, enrollment type, window, and capacity. Seeds LessonProgress records. Re-enrollment is allowed after cancellation. */
  async enroll(user: AuthenticatedUser, dto: CreateEnrollmentDto): Promise<EnrollmentResponseDto> {
    if (user.isVerified === false) {
      throw new ForbiddenException('Email verification required before enrolling');
    }

    const userId = user.id;
    const existing = await this.enrollmentsRepository.findByUserAndCourse(userId, dto.courseId);
    if (existing?.status === 'ACTIVE')
      throw new ConflictException('Already enrolled in this course');
    if (existing?.status === 'COMPLETED')
      throw new ConflictException('This course has already been completed');

    const course = await this.enrollmentsRepository.findCourseWithSettings(dto.courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (course.status !== 'PUBLISHED') {
      throw new BadRequestException('Course is not available for enrollment');
    }

    if (user.roles.includes(UserRole.INSTRUCTOR) && course.instructorId === userId) {
      throw new ForbiddenException('Instructors cannot enroll in their own course');
    }

    const now = new Date();
    const settings = course.settings;

    // Portal mode gate
    const portalMode = this.configService.get('portalMode', { infer: true });
    if (portalMode === 'CORPORATE') {
      const isPrivilegedPortal =
        user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.INSTRUCTOR);
      if (!isPrivilegedPortal) {
        throw new ForbiddenException(
          'En este portal los cursos son asignados por un administrador',
        );
      }
    } else if (portalMode === 'ACADEMIC') {
      if (
        settings?.enrollmentStartDate != null &&
        settings.enrollmentEndDate != null &&
        (now < settings.enrollmentStartDate || now > settings.enrollmentEndDate)
      ) {
        throw new ForbiddenException('El período de inscripción para este curso no está activo');
      }
    }

    // Enrollment type gate (MISTAKES.md [008])
    let validatedCodeId: string | undefined;

    if (course.enrollmentType === EnrollmentType.ASSIGNED) {
      const isPrivileged =
        user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.INSTRUCTOR);
      if (!isPrivileged) {
        throw new ForbiddenException('Este curso requiere asignación por un administrador');
      }
    }

    if (course.enrollmentType === EnrollmentType.CODE) {
      if (!dto.code) {
        throw new BadRequestException('Este curso requiere un código de inscripción');
      }
      const enrollmentCode = await this.enrollmentCodesRepository.findValidCode(
        dto.code,
        dto.courseId,
      );
      if (!enrollmentCode) {
        throw new BadRequestException('Código de inscripción inválido o expirado');
      }
      validatedCodeId = enrollmentCode.id;
    }

    if (settings?.enrollmentStartDate && now < settings.enrollmentStartDate) {
      throw new BadRequestException('Enrollment has not started yet');
    }
    if (settings?.enrollmentEndDate && now > settings.enrollmentEndDate) {
      throw new BadRequestException('Enrollment period has ended');
    }

    let enrollment: EnrollmentResponseDto;

    if (settings?.maxEnrollments != null) {
      const lockKey = `enroll-lock:${dto.courseId}`;
      // 30 s: DB writes (enrollment + progress seeding) can exceed 5 s under load
      const acquired = (await this.redisService.set(lockKey, '1', 'PX', 30000, 'NX')) as
        | string
        | null;
      if (!acquired) throw new ConflictException('Enrollment in progress, please retry');
      try {
        const activeCount = await this.enrollmentsRepository.countActiveByCourseId(dto.courseId);
        if (activeCount >= settings.maxEnrollments) {
          throw new ConflictException('Course enrollment limit has been reached');
        }
        enrollment = await this.createEnrollmentRecord(
          userId,
          dto.courseId,
          settings,
          now,
          existing?.id,
        );
      } finally {
        await this.redisService.del(lockKey);
      }
    } else {
      enrollment = await this.createEnrollmentRecord(
        userId,
        dto.courseId,
        settings,
        now,
        existing?.id,
      );
    }

    if (validatedCodeId) {
      await this.enrollmentCodesRepository.incrementUsage(validatedCodeId);
    }

    return enrollment;
  }

  /** Returns the authenticated user's own enrollments, paginated, with optional status filter. */
  async findMyEnrollments(
    userId: string,
    query: QueryEnrollmentDto,
  ): Promise<PaginatedResult<EnrollmentResponseDto>> {
    const [enrollments, total] = await this.enrollmentsRepository.findManyByUserId(
      userId,
      query,
      query.status,
    );
    return paginate(
      enrollments.map((e) => this.map(e)),
      total,
      query,
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
  ): Promise<PaginatedResult<CourseEnrollmentItemDto>> {
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin) {
      const course = await this.coursesService.findOne(courseId, user);
      if (course.instructorId !== user.id) {
        throw new ForbiddenException('You do not own this course');
      }
    }

    const [enrollments, total] = await this.enrollmentsRepository.findManyByCourseIdWithUser(
      courseId,
      pagination,
    );
    return paginate(
      enrollments.map((e) => this.mapCourseEnrollment(e)),
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

  /**
   * Checks if all published lessons are complete for the enrollment; if so, marks it COMPLETED,
   * calculates the weighted final grade from the gradebook, notifies the student, and creates a COURSE_END calendar event.
   * Safe to call multiple times — exits early if already completed or not all lessons done.
   */
  async checkAndCompleteCourse(enrollmentId: string): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findById(enrollmentId);
    if (!enrollment || enrollment.status !== 'ACTIVE') return;

    const [total, completed] = await Promise.all([
      this.enrollmentsRepository.countPublishedLessons(enrollment.courseId),
      this.enrollmentsRepository.countCompletedLessons(enrollmentId),
    ]);

    if (completed < total) return;

    const finalGrade = await this.calculateFinalGrade(enrollmentId, enrollment.courseId);
    const now = new Date();

    await this.enrollmentsRepository.updateCompletion(enrollmentId, finalGrade, now);

    void this.notificationsService.notify(
      enrollment.userId,
      NotificationType.COURSE_COMPLETED,
      'Course completed',
      'Congratulations! You have completed the course.',
      enrollment.courseId,
      'course',
    );

    void this.enrollmentsRepository.createCalendarEvent({
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      title: 'Course Completed',
      type: CalendarEventType.COURSE_END,
      startDate: now,
      allDay: true,
      referenceId: enrollmentId,
      referenceType: 'enrollment',
    });
  }

  /** Returns a progress summary for an enrollment. Only the enrolled user or admin may access. */
  async getProgressSummary(
    id: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<ProgressSummaryDto> {
    const enrollment = await this.enrollmentsRepository.findByIdWithProgress(id);
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (!isAdmin && enrollment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this enrollment');
    }

    const total = enrollment.progress.length;
    const completedCount = enrollment.progress.filter((p) => p.completedAt !== null).length;
    const progressPercentage = total > 0 ? Math.round((completedCount / total) * 1000) / 10 : 0;

    return {
      totalLessons: total,
      completedLessons: completedCount,
      progressPercentage,
      finalGrade: enrollment.finalGrade ?? null,
      status: enrollment.status,
    };
  }

  /** Bulk-enrolls a list of users in a course (admin assignment). Skips already-active enrollments. */
  async bulkEnroll(dto: BulkEnrollDto): Promise<BulkEnrollResultDto> {
    const course = await this.enrollmentsRepository.findCourseWithSettings(dto.courseId);
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== 'PUBLISHED') {
      throw new BadRequestException('Course is not available for enrollment');
    }
    const lessons = await this.enrollmentsRepository.findPublishedLessons(dto.courseId);
    return this.enrollmentsRepository.bulkCreateWithProgress({
      userIds: dto.userIds,
      courseId: dto.courseId,
      lessons,
    });
  }

  /** Returns all enrollments for a specific user with course details. Admin only. */
  async getAdminUserEnrollments(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<UserEnrollmentItemDto>> {
    const [enrollments, total] = await this.enrollmentsRepository.findManyByUserIdWithCourse(
      userId,
      pagination,
    );
    return paginate(
      enrollments.map((e) => this.mapUserEnrollment(e)),
      total,
      pagination,
    );
  }

  /** Removes a user's enrollment from a course. Cannot remove COMPLETED enrollments. Admin only. */
  async removeUserEnrollment(userId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentsRepository.findByUserAndCourse(userId, courseId);
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status === 'COMPLETED') {
      throw new ConflictException('Cannot remove a completed enrollment');
    }
    await this.enrollmentsRepository.deleteByUserAndCourse(userId, courseId);
  }

  private mapCourseEnrollment(e: EnrollmentForCourseView): CourseEnrollmentItemDto {
    const completed = e.progress.filter((p) => p.completedAt !== null).length;
    const total = e.progress.length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    return {
      enrollmentId: e.id,
      userId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      email: e.user.email,
      avatarUrl: e.user.avatarUrl,
      status: e.status,
      enrolledAt: e.enrolledAt,
      progressPercentage,
    };
  }

  private mapUserEnrollment(e: EnrollmentForUserView): UserEnrollmentItemDto {
    const completed = e.progress.filter((p) => p.completedAt !== null).length;
    const total = e.progress.length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
    return {
      enrollmentId: e.id,
      courseId: e.courseId,
      courseTitle: e.course.title,
      coverUrl: e.course.coverUrl,
      enrollmentType: e.course.enrollmentType,
      status: e.status,
      progressPercentage,
      enrolledAt: e.enrolledAt,
    };
  }

  private async calculateFinalGrade(
    enrollmentId: string,
    courseId: string,
  ): Promise<number | null> {
    const categories = await this.enrollmentsRepository.findGradebookData(courseId, enrollmentId);
    if (categories.length === 0) return null;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const category of categories) {
      if (category.items.length === 0) continue;

      let itemWeightedSum = 0;
      let itemTotalWeight = 0;

      for (const item of category.items) {
        const quizScore = item.lesson.quizAttempts[0]?.score ?? null;
        const submissionGrade = item.lesson.submissions[0]?.grade ?? null;
        const earnedScore = quizScore ?? submissionGrade;
        if (earnedScore === null) continue;

        const w = item.weight ?? 1;
        itemWeightedSum += (earnedScore / item.maxScore) * w;
        itemTotalWeight += w;
      }

      if (itemTotalWeight === 0) continue;

      weightedSum += (itemWeightedSum / itemTotalWeight) * category.weight;
      totalWeight += category.weight;
    }

    if (totalWeight === 0) return null;
    return Math.round((weightedSum / totalWeight) * 1000) / 10;
  }

  private async createEnrollmentRecord(
    userId: string,
    courseId: string,
    settings: CourseSettings | null,
    now: Date,
    existingEnrollmentId?: string,
  ): Promise<EnrollmentResponseDto> {
    const lessons = await this.enrollmentsRepository.findPublishedLessons(courseId);
    const lockAll = !!(settings?.courseStartDate && settings.courseStartDate > now);
    const isSequential = settings?.isSequential ?? false;
    const enrollment = existingEnrollmentId
      ? await this.enrollmentsRepository.reactivateWithProgress({
          enrollmentId: existingEnrollmentId,
          lessons,
          lockAll,
          isSequential,
        })
      : await this.enrollmentsRepository.createWithProgress({
          userId,
          courseId,
          lessons,
          lockAll,
          isSequential,
        });
    return this.map(enrollment);
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
