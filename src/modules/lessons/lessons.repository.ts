import { Injectable } from '@nestjs/common';
import type {
  AssignmentSettings,
  Lesson,
  LessonProgress,
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

  findCourseStatus(courseId: string): Promise<{ status: string } | null> {
    return this.prisma.course.findUnique({ where: { id: courseId }, select: { status: true } });
  }

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
    // Any enrollment status (ACTIVE, COMPLETED, etc.) grants read access to published lessons.
    // Only progress writes require ACTIVE status (see findActiveEnrollmentId).
    return this.prisma.enrollment
      .findFirst({ where: { userId, courseId } })
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

  findActiveEnrollmentId(userId: string, courseId: string): Promise<{ id: string } | null> {
    return this.prisma.enrollment.findFirst({
      where: { userId, courseId, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  findLessonProgress(enrollmentId: string, lessonId: string): Promise<LessonProgress | null> {
    return this.prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    });
  }

  upsertLessonProgress(
    enrollmentId: string,
    lessonId: string,
    createData: {
      startedAt: Date;
      watchedSeconds?: number;
      lastWatchedAt?: Date;
      completedAt?: Date;
    },
    updateData: {
      watchedSeconds?: number;
      lastWatchedAt?: Date;
      completedAt?: Date;
    },
  ): Promise<LessonProgress> {
    return this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      create: { enrollmentId, lessonId, ...createData },
      update: updateData,
    });
  }

  async findCourseIsSequential(courseId: string): Promise<boolean> {
    const settings = await this.prisma.courseSettings.findUnique({
      where: { courseId },
      select: { isSequential: true },
    });
    return settings?.isSequential ?? false;
  }

  async findNextPublishedLesson(
    lessonId: string,
    moduleId: string,
    courseId: string,
  ): Promise<{ id: string } | null> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { order: true },
    });
    if (!lesson) return null;

    const nextInModule = await this.prisma.lesson.findFirst({
      where: { moduleId, order: { gt: lesson.order }, isPublished: true },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    if (nextInModule) return nextInModule;

    const currentModule = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: { order: true },
    });
    if (!currentModule) return null;

    const nextModule = await this.prisma.courseModule.findFirst({
      where: { courseId, order: { gt: currentModule.order }, isPublished: true },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    if (!nextModule) return null;

    return this.prisma.lesson.findFirst({
      where: { moduleId: nextModule.id, isPublished: true },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
  }

  async unlockLessonProgress(enrollmentId: string, lessonId: string): Promise<void> {
    await this.prisma.lessonProgress.updateMany({
      where: { enrollmentId, lessonId },
      data: { isLocked: false },
    });
  }
}
