import { Injectable } from '@nestjs/common';
import type {
  AssignmentSettings,
  Lesson,
  LessonResource,
  Prisma,
  QuizSettings,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonWithDetails = Lesson & {
  resources: LessonResource[];
  quizSettings: QuizSettings | null;
  assignmentSettings: AssignmentSettings | null;
  module: { courseId: string };
};

@Injectable()
export class LessonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByModuleId(moduleId: string, publishedOnly?: boolean): Promise<Lesson[]> {
    return this.prisma.lesson.findMany({
      where: {
        moduleId,
        ...(publishedOnly && { isPublished: true }),
      },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string): Promise<Lesson | null> {
    return this.prisma.lesson.findUnique({ where: { id } });
  }

  findByIdWithModule(id: string): Promise<(Lesson & { module: { courseId: string } }) | null> {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: { module: { select: { courseId: true } } },
    });
  }

  findModuleByCourseId(moduleId: string, courseId: string): Promise<{ id: string } | null> {
    return this.prisma.courseModule.findFirst({
      where: { id: moduleId, courseId },
      select: { id: true },
    });
  }

  findByIdWithDetails(id: string): Promise<LessonWithDetails | null> {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: {
        resources: { orderBy: { createdAt: 'asc' } },
        quizSettings: true,
        assignmentSettings: true,
        module: { select: { courseId: true } },
      },
    });
  }

  async getMaxOrder(moduleId: string): Promise<number> {
    const result = await this.prisma.lesson.aggregate({
      where: { moduleId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  countProgress(lessonId: string): Promise<number> {
    return this.prisma.lessonProgress.count({ where: { lessonId } });
  }

  isEnrolled(userId: string, courseId: string): Promise<boolean> {
    return this.prisma.enrollment
      .findFirst({ where: { userId, courseId, status: 'ACTIVE' } })
      .then((e) => e !== null);
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

  async reorder(items: { id: string; order: number }[]): Promise<void> {
    await this.prisma.$transaction(
      items.map(({ id, order }) => this.prisma.lesson.update({ where: { id }, data: { order } })),
    );
  }

  createResource(data: Prisma.LessonResourceCreateInput): Promise<LessonResource> {
    return this.prisma.lessonResource.create({ data });
  }

  async findIdsByModuleId(moduleId: string): Promise<string[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { moduleId },
      select: { id: true },
    });
    return lessons.map((l) => l.id);
  }

  findResourceById(id: string, lessonId: string): Promise<LessonResource | null> {
    return this.prisma.lessonResource.findFirst({ where: { id, lessonId } });
  }

  deleteResource(id: string): Promise<LessonResource> {
    return this.prisma.lessonResource.delete({ where: { id } });
  }
}
