import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type CourseRating, RatingScale } from '@prisma/client';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CourseRatingSettings } from './ratings.repository';
import { RatingsRepository } from './ratings.repository';
import { RatingsService } from './ratings.service';

const now = new Date('2026-01-01');

const mockRating: CourseRating = {
  id: 'rating-1',
  userId: 'user-1',
  courseId: 'course-1',
  score: 4,
  review: 'Great course!',
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
};

const mockCourseSettings: CourseRatingSettings = {
  instructorId: 'instructor-1',
  settings: { ratingEnabled: true, ratingScale: RatingScale.STARS_5 },
};

const pagination = {
  page: 1,
  limit: 20,
  get skip(): number {
    return 0;
  },
};

describe('RatingsService', () => {
  let service: RatingsService;
  let repo: jest.Mocked<
    Pick<
      RatingsRepository,
      | 'findCourseRatingSettings'
      | 'findByUserAndCourse'
      | 'findMany'
      | 'create'
      | 'update'
      | 'getSummary'
    >
  >;
  let enrollmentsService: jest.Mocked<Pick<EnrollmentsService, 'isEnrolled'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'notify'>>;

  beforeEach(async () => {
    repo = {
      findCourseRatingSettings: jest.fn(),
      findByUserAndCourse: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      getSummary: jest.fn(),
    };
    enrollmentsService = { isEnrolled: jest.fn() };
    notificationsService = { notify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: RatingsRepository, useValue: repo },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(RatingsService);
  });

  describe('create', () => {
    it('should create a rating and notify the instructor', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockRating);
      notificationsService.notify.mockResolvedValue(undefined);

      const result = await service.create('user-1', {
        courseId: 'course-1',
        score: 4,
        review: 'Great!',
      });

      expect(result.id).toBe('rating-1');
      expect(result.score).toBe(4);
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'instructor-1',
        expect.anything(),
        expect.any(String),
        expect.any(String),
        'rating-1',
        'course_rating',
      );
    });

    it('should throw NotFoundException when course does not exist', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(null);

      await expect(service.create('user-1', { courseId: 'course-1', score: 4 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when ratings are disabled', async () => {
      repo.findCourseRatingSettings.mockResolvedValue({
        ...mockCourseSettings,
        settings: { ratingEnabled: false, ratingScale: RatingScale.STARS_5 },
      });

      await expect(service.create('user-1', { courseId: 'course-1', score: 4 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when user is not enrolled', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(false);
      repo.findByUserAndCourse.mockResolvedValue(null);

      await expect(service.create('user-1', { courseId: 'course-1', score: 4 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException when user has already rated the course', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.findByUserAndCourse.mockResolvedValue(mockRating);

      await expect(service.create('user-1', { courseId: 'course-1', score: 4 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when score exceeds STARS_5 max (5)', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);

      await expect(service.create('user-1', { courseId: 'course-1', score: 6 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when score exceeds NUMERIC_10 max (10)', async () => {
      repo.findCourseRatingSettings.mockResolvedValue({
        ...mockCourseSettings,
        settings: { ratingEnabled: true, ratingScale: RatingScale.NUMERIC_10 },
      });
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.findByUserAndCourse.mockResolvedValue(null);

      await expect(service.create('user-1', { courseId: 'course-1', score: 11 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow score up to 100 for NUMERIC_100 scale', async () => {
      const rating100: CourseRating = { ...mockRating, score: 95 };
      repo.findCourseRatingSettings.mockResolvedValue({
        ...mockCourseSettings,
        settings: { ratingEnabled: true, ratingScale: RatingScale.NUMERIC_100 },
      });
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.findByUserAndCourse.mockResolvedValue(null);
      repo.create.mockResolvedValue(rating100);
      notificationsService.notify.mockResolvedValue(undefined);

      const result = await service.create('user-1', { courseId: 'course-1', score: 95 });

      expect(result.score).toBe(95);
    });
  });

  describe('update', () => {
    it('should update an existing rating', async () => {
      const updatedRating: CourseRating = { ...mockRating, score: 5, review: 'Even better!' };
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      repo.findByUserAndCourse.mockResolvedValue(mockRating);
      repo.update.mockResolvedValue(updatedRating);

      const result = await service.update('user-1', 'course-1', {
        score: 5,
        review: 'Even better!',
      });

      expect(result.score).toBe(5);
      expect(result.review).toBe('Even better!');
    });

    it('should throw NotFoundException when rating does not exist', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      repo.findByUserAndCourse.mockResolvedValue(null);

      await expect(service.update('user-1', 'course-1', { score: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when updated score exceeds scale max', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings); // STARS_5

      await expect(service.update('user-1', 'course-1', { score: 6 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getSummary', () => {
    it('should return average score, total ratings, and scale', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      repo.getSummary.mockResolvedValue({ avg: 4.2, count: 10 });

      const result = await service.getSummary('course-1');

      expect(result.averageScore).toBe(4.2);
      expect(result.totalRatings).toBe(10);
      expect(result.scale).toBe(RatingScale.STARS_5);
    });

    it('should return averageScore 0 when there are no ratings', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(mockCourseSettings);
      repo.getSummary.mockResolvedValue({ avg: null, count: 0 });

      const result = await service.getSummary('course-1');

      expect(result.averageScore).toBe(0);
      expect(result.totalRatings).toBe(0);
    });

    it('should throw NotFoundException when course does not exist', async () => {
      repo.findCourseRatingSettings.mockResolvedValue(null);

      await expect(service.getSummary('course-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRatings', () => {
    it('should return paginated ratings for a course', async () => {
      repo.findMany.mockResolvedValue([[mockRating], 1]);

      const result = await service.getRatings('course-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].courseId).toBe('course-1');
      expect(result.meta.total).toBe(1);
    });
  });
});
