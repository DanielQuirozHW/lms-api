import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Enrollment } from '@prisma/client';
import { EnrollmentStatus, UserRole } from '@prisma/client';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import type { CourseWithSettings } from './enrollments.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

const mockEnrollment: Enrollment = {
  id: 'enrollment-1',
  userId: 'user-1',
  courseId: 'course-1',
  status: EnrollmentStatus.ACTIVE,
  completedAt: null,
  enrolledAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  finalGrade: null,
  gradedAt: null,
};

const mockCourse: CourseWithSettings = {
  id: 'course-1',
  title: 'Test Course',
  slug: 'test-course',
  description: null,
  coverUrl: null,
  price: null,
  categoryId: null,
  status: 'PUBLISHED',
  instructorId: 'instructor-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  settings: null,
};

const baseSettings = {
  id: 'settings-1',
  courseId: 'course-1',
  enrollmentStartDate: null,
  enrollmentEndDate: null,
  courseStartDate: null,
  hasModules: true,
  forumEnabled: true,
  forumPublic: false,
  certificateEnabled: false,
  ratingEnabled: true,
  ratingScale: 'STARS_5' as const,
  maxEnrollments: null,
  isSequential: false,
};

const mockAdmin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  roles: [UserRole.ADMIN],
};

const mockStudent: AuthenticatedUser = {
  id: 'user-1',
  email: 'student@test.com',
  roles: [UserRole.STUDENT],
};

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let repo: jest.Mocked<
    Pick<
      EnrollmentsRepository,
      | 'findByUserAndCourse'
      | 'findCourseWithSettings'
      | 'countActiveByCourseId'
      | 'findActiveByUserAndCourse'
      | 'findPublishedLessons'
      | 'createWithProgress'
      | 'reactivateWithProgress'
      | 'findById'
      | 'findByIdWithProgress'
      | 'findManyByUserId'
      | 'findManyByCourseId'
      | 'updateStatus'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;
  let redisService: jest.Mocked<Pick<RedisService, 'set' | 'del'>>;

  beforeEach(async () => {
    repo = {
      findByUserAndCourse: jest.fn(),
      findCourseWithSettings: jest.fn(),
      countActiveByCourseId: jest.fn(),
      findActiveByUserAndCourse: jest.fn(),
      findPublishedLessons: jest.fn(),
      createWithProgress: jest.fn(),
      reactivateWithProgress: jest.fn(),
      findById: jest.fn(),
      findByIdWithProgress: jest.fn(),
      findManyByUserId: jest.fn(),
      findManyByCourseId: jest.fn(),
      updateStatus: jest.fn(),
    };
    coursesService = { findOne: jest.fn() };
    redisService = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: EnrollmentsRepository, useValue: repo },
        { provide: CoursesService, useValue: coursesService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get(EnrollmentsService);
  });

  describe('enroll', () => {
    it('should enroll a user successfully', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue(mockCourse);
      repo.findPublishedLessons.mockResolvedValue([]);
      repo.createWithProgress.mockResolvedValue(mockEnrollment);

      const result = await service.enroll(mockStudent, { courseId: 'course-1' });

      expect(result.id).toBe('enrollment-1');
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
      expect(repo.createWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', courseId: 'course-1' }),
      );
    });

    it('should throw ForbiddenException when user email is not verified', async () => {
      const unverifiedUser: AuthenticatedUser = { ...mockStudent, isVerified: false };

      await expect(service.enroll(unverifiedUser, { courseId: 'course-1' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.findByUserAndCourse).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when instructor tries to enroll in own course', async () => {
      const instructor: AuthenticatedUser = {
        id: 'instructor-1',
        email: 'i@test.com',
        roles: [UserRole.INSTRUCTOR],
      };
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue(mockCourse);

      await expect(service.enroll(instructor, { courseId: 'course-1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when already actively enrolled', async () => {
      repo.findByUserAndCourse.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
      });

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when course already completed', async () => {
      repo.findByUserAndCourse.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.COMPLETED,
      });

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should re-enroll after cancellation using reactivateWithProgress', async () => {
      const cancelledEnrollment = { ...mockEnrollment, status: EnrollmentStatus.CANCELLED };
      repo.findByUserAndCourse.mockResolvedValue(cancelledEnrollment);
      repo.findCourseWithSettings.mockResolvedValue(mockCourse);
      repo.findPublishedLessons.mockResolvedValue([]);
      repo.reactivateWithProgress.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.ACTIVE,
      });

      const result = await service.enroll(mockStudent, { courseId: 'course-1' });

      expect(repo.reactivateWithProgress).toHaveBeenCalledWith(
        expect.objectContaining({ enrollmentId: cancelledEnrollment.id }),
      );
      expect(repo.createWithProgress).not.toHaveBeenCalled();
      expect(result.status).toBe(EnrollmentStatus.ACTIVE);
    });

    it('should throw NotFoundException when course not found', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue(null);

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when course is not PUBLISHED', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({ ...mockCourse, status: 'DRAFT' });

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when course is full', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({
        ...mockCourse,
        settings: { ...baseSettings, maxEnrollments: 10 },
      });
      redisService.set.mockResolvedValue('OK');
      repo.countActiveByCourseId.mockResolvedValue(10);

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
      expect(redisService.del).toHaveBeenCalledWith('enroll-lock:course-1');
    });

    it('should throw ConflictException when enrollment lock cannot be acquired', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({
        ...mockCourse,
        settings: { ...baseSettings, maxEnrollments: 10 },
      });
      redisService.set.mockResolvedValue(null);

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        ConflictException,
      );
      expect(repo.countActiveByCourseId).not.toHaveBeenCalled();
    });

    it('should enroll successfully under capacity and release lock', async () => {
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({
        ...mockCourse,
        settings: { ...baseSettings, maxEnrollments: 10 },
      });
      redisService.set.mockResolvedValue('OK');
      repo.countActiveByCourseId.mockResolvedValue(5);
      repo.findPublishedLessons.mockResolvedValue([]);
      repo.createWithProgress.mockResolvedValue(mockEnrollment);

      const result = await service.enroll(mockStudent, { courseId: 'course-1' });

      expect(result.id).toBe('enrollment-1');
      expect(redisService.del).toHaveBeenCalledWith('enroll-lock:course-1');
    });

    it('should throw BadRequestException when enrollment window has not started', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({
        ...mockCourse,
        settings: { ...baseSettings, enrollmentStartDate: futureDate },
      });

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when enrollment window has ended', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.findCourseWithSettings.mockResolvedValue({
        ...mockCourse,
        settings: { ...baseSettings, enrollmentEndDate: pastDate },
      });

      await expect(service.enroll(mockStudent, { courseId: 'course-1' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findMyEnrollments', () => {
    it('should return paginated enrollments for a user', async () => {
      repo.findManyByUserId.mockResolvedValue([[mockEnrollment], 1]);

      const result: PaginatedResult<unknown> = await service.findMyEnrollments('user-1', {
        page: 1,
        limit: 20,
        get skip() {
          return (this.page - 1) * (this.limit ?? 20);
        },
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return enrollment detail for the enrolled user', async () => {
      repo.findByIdWithProgress.mockResolvedValue({ ...mockEnrollment, progress: [] });

      const result = await service.findOne('enrollment-1', 'user-1', false);

      expect(result.id).toBe('enrollment-1');
      expect(result.progress.totalLessons).toBe(0);
    });

    it('should throw NotFoundException when enrollment not found', async () => {
      repo.findByIdWithProgress.mockResolvedValue(null);

      await expect(service.findOne('enrollment-1', 'user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user does not own the enrollment', async () => {
      repo.findByIdWithProgress.mockResolvedValue({ ...mockEnrollment, progress: [] });

      await expect(service.findOne('enrollment-1', 'other-user', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to access any enrollment', async () => {
      repo.findByIdWithProgress.mockResolvedValue({ ...mockEnrollment, progress: [] });

      const result = await service.findOne('enrollment-1', 'admin-1', true);

      expect(result.id).toBe('enrollment-1');
    });
  });

  describe('cancel', () => {
    it('should cancel an active enrollment successfully', async () => {
      repo.findById.mockResolvedValue(mockEnrollment);
      repo.updateStatus.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.CANCELLED,
      });

      await expect(service.cancel('enrollment-1', 'user-1', false)).resolves.toBeUndefined();
      expect(repo.updateStatus).toHaveBeenCalledWith('enrollment-1', 'CANCELLED');
    });

    it('should throw ConflictException when trying to cancel a completed enrollment', async () => {
      repo.findById.mockResolvedValue({ ...mockEnrollment, status: EnrollmentStatus.COMPLETED });

      await expect(service.cancel('enrollment-1', 'user-1', false)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException when student tries to cancel another user enrollment', async () => {
      repo.findById.mockResolvedValue(mockEnrollment);

      await expect(service.cancel('enrollment-1', 'other-user', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to cancel any enrollment', async () => {
      repo.findById.mockResolvedValue(mockEnrollment);
      repo.updateStatus.mockResolvedValue({
        ...mockEnrollment,
        status: EnrollmentStatus.CANCELLED,
      });

      await expect(service.cancel('enrollment-1', 'admin-1', true)).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when enrollment not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.cancel('enrollment-1', 'user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getByCourseId', () => {
    it('should return enrollments for admin without ownership check', async () => {
      repo.findManyByCourseId.mockResolvedValue([[mockEnrollment], 1]);

      const result = await service.getByCourseId('course-1', mockAdmin, {
        page: 1,
        limit: 20,
        get skip() {
          return (this.page - 1) * (this.limit ?? 20);
        },
      });

      expect(result.data).toHaveLength(1);
      expect(coursesService.findOne).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when instructor does not own the course', async () => {
      const instructor: AuthenticatedUser = {
        id: 'other-instructor',
        email: 'i@test.com',
        roles: [UserRole.INSTRUCTOR],
      };
      coursesService.findOne.mockResolvedValue({
        instructorId: 'instructor-1',
        lessonsCount: 0,
        enrollmentsCount: 0,
      } as CourseDetailResponseDto);

      await expect(
        service.getByCourseId('course-1', instructor, {
          page: 1,
          limit: 20,
          get skip() {
            return (this.page - 1) * (this.limit ?? 20);
          },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('complete', () => {
    it('should mark an active enrollment as completed', async () => {
      const completedEnrollment = {
        ...mockEnrollment,
        status: EnrollmentStatus.COMPLETED,
        completedAt: new Date(),
      };
      repo.findById.mockResolvedValue(mockEnrollment);
      repo.updateStatus.mockResolvedValue(completedEnrollment);

      const result = await service.complete('enrollment-1');

      expect(result.status).toBe(EnrollmentStatus.COMPLETED);
      expect(repo.updateStatus).toHaveBeenCalledWith('enrollment-1', 'COMPLETED', expect.any(Date));
    });

    it('should throw ConflictException when enrollment is not active', async () => {
      repo.findById.mockResolvedValue({ ...mockEnrollment, status: EnrollmentStatus.CANCELLED });

      await expect(service.complete('enrollment-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('progress summary calculation', () => {
    it('should calculate progress percentage correctly', async () => {
      const progress = [
        { completedAt: new Date() },
        { completedAt: new Date() },
        { completedAt: null },
        { completedAt: null },
        { completedAt: null },
      ];
      repo.findByIdWithProgress.mockResolvedValue({
        ...mockEnrollment,
        progress: progress as never,
      });

      const result = await service.findOne('enrollment-1', 'user-1', false);

      expect(result.progress.totalLessons).toBe(5);
      expect(result.progress.completedLessons).toBe(2);
      expect(result.progress.progressPercentage).toBe(40);
    });

    it('should return 0 progress percentage when no lessons', async () => {
      repo.findByIdWithProgress.mockResolvedValue({ ...mockEnrollment, progress: [] });

      const result = await service.findOne('enrollment-1', 'user-1', false);

      expect(result.progress.progressPercentage).toBe(0);
    });
  });
});
