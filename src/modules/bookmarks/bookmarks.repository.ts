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

@Injectable()
export class BookmarksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string, skip: number, take: number): Promise<BookmarkWithLesson[]> {
    return this.prisma.lessonBookmark.findMany({
      where: { userId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            moduleId: true,
            module: {
              select: {
                courseId: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  countByUser(userId: string): Promise<number> {
    return this.prisma.lessonBookmark.count({ where: { userId } });
  }

  findByUserAndLesson(userId: string, lessonId: string): Promise<LessonBookmark | null> {
    return this.prisma.lessonBookmark.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  createWithDetails(userId: string, lessonId: string): Promise<BookmarkWithLesson> {
    return this.prisma.lessonBookmark.create({
      data: { userId, lessonId },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            type: true,
            moduleId: true,
            module: {
              select: {
                courseId: true,
                course: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });
  }

  delete(userId: string, lessonId: string): Promise<LessonBookmark> {
    return this.prisma.lessonBookmark.delete({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }
}
