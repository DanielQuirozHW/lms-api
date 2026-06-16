import { Injectable } from '@nestjs/common';
import type { LessonBookmark } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type BookmarkWithLesson = LessonBookmark & {
  lesson: {
    id: string;
    title: string;
    type: string;
    moduleId: string;
    module: {
      courseId: string;
      course: { id: string; title: string };
    };
  };
};

const lessonInclude = {
  lesson: {
    include: {
      module: {
        include: {
          course: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class BookmarksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string, skip: number, take: number): Promise<BookmarkWithLesson[]> {
    return this.prisma.lessonBookmark.findMany({
      where: { userId, isActive: true },
      include: lessonInclude,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  countByUser(userId: string): Promise<number> {
    return this.prisma.lessonBookmark.count({ where: { userId, isActive: true } });
  }

  findByUserAndLesson(userId: string, lessonId: string): Promise<LessonBookmark | null> {
    return this.prisma.lessonBookmark.findFirst({ where: { userId, lessonId, isActive: true } });
  }

  /** Creates a bookmark, or restores it if previously soft-deleted. */
  createWithDetails(userId: string, lessonId: string): Promise<BookmarkWithLesson> {
    return this.prisma.lessonBookmark.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: { isActive: true },
      include: lessonInclude,
    });
  }

  /** Soft-deletes the bookmark by setting isActive = false. */
  delete(userId: string, lessonId: string): Promise<LessonBookmark> {
    return this.prisma.lessonBookmark.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: { isActive: false },
    });
  }
}
