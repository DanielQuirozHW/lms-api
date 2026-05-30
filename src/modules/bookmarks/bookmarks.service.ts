import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import { paginate, type PaginationDto } from '../../common/dto/pagination.dto';
import type { BookmarkWithLesson } from './bookmarks.repository';
import { BookmarksRepository } from './bookmarks.repository';
import type { BookmarkResponseDto, CheckBookmarkResponseDto } from './dto/bookmark.dto';

@Injectable()
export class BookmarksService {
  constructor(private readonly bookmarksRepository: BookmarksRepository) {}

  /** Returns the current user's bookmarked lessons with lesson + course context, paginated. */
  async findAll(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<BookmarkResponseDto>> {
    const [bookmarks, total] = await Promise.all([
      this.bookmarksRepository.findByUser(userId, pagination.skip, pagination.limit ?? 20),
      this.bookmarksRepository.countByUser(userId),
    ]);
    return paginate(
      bookmarks.map((b) => this.map(b)),
      total,
      pagination,
    );
  }

  /**
   * Creates a bookmark and returns the full response with lesson details.
   * Prisma P2002 (unique constraint on userId+lessonId) bubbles up as 409 via GlobalExceptionFilter.
   */
  async create(userId: string, lessonId: string): Promise<BookmarkResponseDto> {
    const bookmark = await this.bookmarksRepository.createWithDetails(userId, lessonId);
    return this.map(bookmark);
  }

  /** Returns whether the current user has bookmarked a specific lesson. */
  async check(userId: string, lessonId: string): Promise<CheckBookmarkResponseDto> {
    const bookmark = await this.bookmarksRepository.findByUserAndLesson(userId, lessonId);
    return { bookmarked: bookmark !== null };
  }

  /** Deletes a bookmark by lessonId. Throws 404 if the bookmark does not exist. */
  async delete(userId: string, lessonId: string): Promise<void> {
    const existing = await this.bookmarksRepository.findByUserAndLesson(userId, lessonId);
    if (!existing) throw new NotFoundException('Bookmark not found');
    await this.bookmarksRepository.delete(userId, lessonId);
  }

  private map(b: BookmarkWithLesson): BookmarkResponseDto {
    return {
      id: b.id,
      lessonId: b.lesson.id,
      lessonTitle: b.lesson.title,
      lessonType: b.lesson.type as never,
      moduleId: b.lesson.moduleId,
      courseId: b.lesson.module.courseId,
      courseTitle: b.lesson.module.course.title,
      createdAt: b.createdAt,
    };
  }
}
