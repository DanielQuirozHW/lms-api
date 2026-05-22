import { Injectable } from '@nestjs/common';
import type { CourseModule, Lesson, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CourseModuleWithLessons = CourseModule & { lessons: Lesson[] };

@Injectable()
export class CourseModulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseId(courseId: string, publishedOnly?: boolean): Promise<CourseModule[]> {
    return this.prisma.courseModule.findMany({
      where: {
        courseId,
        ...(publishedOnly && { isPublished: true }),
      },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string): Promise<CourseModule | null> {
    return this.prisma.courseModule.findUnique({ where: { id } });
  }

  findByIdWithLessons(id: string, publishedOnly: boolean): Promise<CourseModuleWithLessons | null> {
    return this.prisma.courseModule.findUnique({
      where: { id },
      include: {
        lessons: {
          where: publishedOnly ? { isPublished: true } : undefined,
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getMaxOrder(courseId: string): Promise<number> {
    const result = await this.prisma.courseModule.aggregate({
      where: { courseId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  countPublishedLessons(moduleId: string): Promise<number> {
    return this.prisma.lesson.count({ where: { moduleId, isPublished: true } });
  }

  async findIdsByCourseId(courseId: string): Promise<string[]> {
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId },
      select: { id: true },
    });
    return modules.map((m) => m.id);
  }

  create(data: Prisma.CourseModuleCreateInput): Promise<CourseModule> {
    return this.prisma.courseModule.create({ data });
  }

  update(id: string, data: Prisma.CourseModuleUpdateInput): Promise<CourseModule> {
    return this.prisma.courseModule.update({ where: { id }, data });
  }

  delete(id: string): Promise<CourseModule> {
    return this.prisma.courseModule.delete({ where: { id } });
  }

  async reorder(items: { id: string; order: number }[]): Promise<void> {
    await this.prisma.$transaction(
      items.map(({ id, order }) =>
        this.prisma.courseModule.update({ where: { id }, data: { order } }),
      ),
    );
  }
}
