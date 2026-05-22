import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type CourseRating, NotificationType, RatingScale } from '@prisma/client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateRatingDto } from './dto/create-rating.dto';
import type { RatingResponseDto } from './dto/rating-response.dto';
import type { RatingSummaryDto } from './dto/rating-summary.dto';
import type { UpdateRatingDto } from './dto/update-rating.dto';
import { RatingsRepository } from './ratings.repository';

const MAX_SCORE: Record<RatingScale, number> = {
  [RatingScale.STARS_5]: 5,
  [RatingScale.NUMERIC_10]: 10,
  [RatingScale.NUMERIC_100]: 100,
};

@Injectable()
export class RatingsService {
  constructor(
    private readonly ratingsRepository: RatingsRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateRatingDto): Promise<RatingResponseDto> {
    const courseData = await this.ratingsRepository.findCourseRatingSettings(dto.courseId);
    if (!courseData) throw new NotFoundException('Course not found');

    if (courseData.settings && !courseData.settings.ratingEnabled) {
      throw new BadRequestException('Ratings are disabled for this course');
    }

    if (courseData.instructorId === userId) {
      throw new ForbiddenException('Instructors cannot rate their own courses');
    }

    const scale = courseData.settings?.ratingScale ?? RatingScale.STARS_5;
    this.assertValidScore(dto.score, scale);

    const enrolled = await this.enrollmentsService.isEnrolled(userId, dto.courseId);
    if (!enrolled) throw new ForbiddenException('You must be enrolled to rate this course');

    const existing = await this.ratingsRepository.findByUserAndCourse(userId, dto.courseId);
    if (existing) {
      throw new ConflictException('You have already rated this course — use PATCH to update it');
    }

    const rating = await this.ratingsRepository.create({
      userId,
      courseId: dto.courseId,
      score: dto.score,
      review: dto.review,
    });

    await this.notificationsService.notify(
      courseData.instructorId,
      NotificationType.ANNOUNCEMENT,
      'New course rating',
      `Your course received a ${String(dto.score)}/${String(MAX_SCORE[scale])} rating`,
      rating.id,
      'course_rating',
    );

    return this.map(rating);
  }

  async update(userId: string, courseId: string, dto: UpdateRatingDto): Promise<RatingResponseDto> {
    const courseData = await this.ratingsRepository.findCourseRatingSettings(courseId);
    if (!courseData) throw new NotFoundException('Course not found');

    if (courseData.settings && !courseData.settings.ratingEnabled) {
      throw new BadRequestException('Ratings are disabled for this course');
    }

    if (dto.score !== undefined) {
      const scale = courseData.settings?.ratingScale ?? RatingScale.STARS_5;
      this.assertValidScore(dto.score, scale);
    }

    const existing = await this.ratingsRepository.findByUserAndCourse(userId, courseId);
    if (!existing) throw new NotFoundException('Rating not found');

    const updated = await this.ratingsRepository.update(userId, courseId, {
      score: dto.score,
      review: dto.review,
    });
    return this.map(updated);
  }

  async getRatings(
    courseId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<RatingResponseDto>> {
    const [ratings, total] = await this.ratingsRepository.findMany(courseId, pagination);
    return paginate(
      ratings.map((r) => this.map(r)),
      total,
      pagination,
    );
  }

  async getSummary(courseId: string): Promise<RatingSummaryDto> {
    const courseData = await this.ratingsRepository.findCourseRatingSettings(courseId);
    if (!courseData) throw new NotFoundException('Course not found');
    const { avg, count } = await this.ratingsRepository.getSummary(courseId);
    return {
      averageScore: avg ?? 0,
      totalRatings: count,
      scale: courseData.settings?.ratingScale ?? RatingScale.STARS_5,
    };
  }

  private assertValidScore(score: number, scale: RatingScale): void {
    const max = MAX_SCORE[scale];
    if (score > max) {
      throw new BadRequestException(
        `Score must be between 1 and ${String(max)} for scale ${scale}`,
      );
    }
  }

  private map(rating: CourseRating): RatingResponseDto {
    return {
      id: rating.id,
      userId: rating.userId,
      courseId: rating.courseId,
      score: rating.score,
      review: rating.review,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}
