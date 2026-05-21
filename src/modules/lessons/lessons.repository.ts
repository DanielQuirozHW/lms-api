import { Injectable } from '@nestjs/common';
import type { Lesson, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LessonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseId(courseId: string): Promise<Lesson[]> {
    return this.prisma.lesson.findMany({
      where: { module: { courseId } },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findUnique({ where: { id } });
  }

  create(data: Prisma.LessonCreateInput): Promise<Lesson> {
    return this.prisma.lesson.create({ data });
  }

  update(id: string, data: Prisma.LessonUpdateInput): Promise<Lesson> {
    return this.prisma.lesson.update({ where: { id }, data });
  }

  delete(id: string): Promise<Lesson> {
    return this.prisma.lesson.delete({ where: { id } });
  }

  async reorder(_courseId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.lesson.update({ where: { id }, data: { order: index + 1 } }),
      ),
    );
  }
}
