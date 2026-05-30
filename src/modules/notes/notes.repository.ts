import { Injectable } from '@nestjs/common';
import type { LessonNote } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserAndLesson(userId: string, lessonId: string): Promise<LessonNote | null> {
    return this.prisma.lessonNote.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  upsert(userId: string, lessonId: string, content: string): Promise<LessonNote> {
    return this.prisma.lessonNote.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, content },
      update: { content },
    });
  }

  delete(userId: string, lessonId: string): Promise<LessonNote> {
    return this.prisma.lessonNote.delete({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }
}
