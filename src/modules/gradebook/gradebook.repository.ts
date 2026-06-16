import { Injectable } from '@nestjs/common';
import type { GradebookCategory, GradebookItem, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CategoryWithItems = GradebookCategory & { items: GradebookItem[] };

@Injectable()
export class GradebookRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCategoriesWithItems(courseId: string): Promise<CategoryWithItems[]> {
    return this.prisma.gradebookCategory.findMany({
      where: { courseId, isActive: true },
      include: { items: { where: { isActive: true } } },
      orderBy: { order: 'asc' },
    });
  }

  findCategoryById(
    id: string,
  ): Promise<(GradebookCategory & { _count: { items: number } }) | null> {
    return this.prisma.gradebookCategory.findFirst({
      where: { id, isActive: true },
      include: { _count: { select: { items: true } } },
    });
  }

  findCategoryByIdAndCourse(
    id: string,
    courseId: string,
  ): Promise<(GradebookCategory & { _count: { items: number } }) | null> {
    return this.prisma.gradebookCategory.findFirst({
      where: { id, courseId, isActive: true },
      include: { _count: { select: { items: true } } },
    });
  }

  findItemById(id: string): Promise<GradebookItem | null> {
    return this.prisma.gradebookItem.findFirst({ where: { id, isActive: true } });
  }

  findItemByCategoryAndCourse(id: string, courseId: string): Promise<GradebookItem | null> {
    return this.prisma.gradebookItem.findFirst({
      where: { id, isActive: true, category: { courseId } },
    });
  }

  createCategory(data: Prisma.GradebookCategoryCreateInput): Promise<GradebookCategory> {
    return this.prisma.gradebookCategory.create({ data });
  }

  updateCategory(
    id: string,
    data: Prisma.GradebookCategoryUpdateInput,
  ): Promise<GradebookCategory> {
    return this.prisma.gradebookCategory.update({ where: { id }, data });
  }

  deleteCategory(id: string): Promise<GradebookCategory> {
    return this.prisma.gradebookCategory.delete({ where: { id } });
  }

  createItem(data: Prisma.GradebookItemCreateInput): Promise<GradebookItem> {
    return this.prisma.gradebookItem.create({ data });
  }

  deleteItem(id: string): Promise<GradebookItem> {
    return this.prisma.gradebookItem.delete({ where: { id } });
  }

  /** Returns a lesson ID only when the lesson belongs to the given course (via module FK). */
  findLessonInCourse(lessonId: string, courseId: string): Promise<{ id: string } | null> {
    return this.prisma.lesson.findFirst({
      where: { id: lessonId, module: { courseId } },
      select: { id: true },
    });
  }

  findEnrollmentById(
    enrollmentId: string,
  ): Promise<{ id: string; courseId: string; userId: string } | null> {
    return this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, courseId: true, userId: true },
    });
  }

  /** Gets best quiz attempt score per lesson for this enrollment. */
  async getQuizScores(enrollmentId: string): Promise<Map<string, number>> {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { enrollmentId, score: { not: null } },
      select: { lessonId: true, score: true },
    });
    const map = new Map<string, number>();
    for (const a of attempts) {
      const existing = map.get(a.lessonId);
      const score = a.score as number;
      if (existing === undefined || score > existing) {
        map.set(a.lessonId, score);
      }
    }
    return map;
  }

  /** Gets highest submission grade per lesson for this enrollment. */
  async getSubmissionScores(enrollmentId: string): Promise<Map<string, number>> {
    const submissions = await this.prisma.submission.findMany({
      where: { enrollmentId, grade: { not: null } },
      select: { lessonId: true, grade: true },
    });
    const map = new Map<string, number>();
    for (const s of submissions) {
      const grade = s.grade as number;
      const existing = map.get(s.lessonId);
      if (existing === undefined || grade > existing) {
        map.set(s.lessonId, grade);
      }
    }
    return map;
  }
}
