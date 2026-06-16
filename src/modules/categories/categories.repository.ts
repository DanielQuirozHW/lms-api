import { Injectable } from '@nestjs/common';
import type { Category } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, isActive: true } });
  }

  create(data: { name: string; slug: string }): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: { name?: string; slug?: string }): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  /** Soft-deletes the category by setting isActive = false. */
  async delete(id: string): Promise<void> {
    await this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  countCourses(categoryId: string): Promise<number> {
    return this.prisma.course.count({ where: { categoryId } });
  }
}
