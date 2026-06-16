import { Injectable } from '@nestjs/common';
import type { LessonNote } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserAndLesson(userId: string, lessonId: string): Promise<LessonNote | null> {
    return this.prisma.lessonNote.findFirst({
      where: { userId, lessonId, isActive: true },
    });
  }

  upsert(userId: string, lessonId: string, content: string): Promise<LessonNote> {
    return this.prisma.lessonNote.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, content },
      update: { content, isActive: true },
    });
  }

  /** Soft-deletes the note by setting isActive = false. */
  delete(userId: string, lessonId: string): Promise<LessonNote> {
    return this.prisma.lessonNote.update({
      where: { userId_lessonId: { userId, lessonId } },
      data: { isActive: false },
    });
  }
}
