import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Category } from '@prisma/client';
import { slugify } from '../../common/utils/slug.util';
import { CategoriesRepository } from './categories.repository';
import type { CategoryResponseDto } from './dto/category-response.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesRepository.findAll();
    return categories.map((c) => this.map(c));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = slugify(dto.name);
    const category = await this.categoriesRepository.create({ name: dto.name, slug });
    return this.map(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    const data: { name?: string; slug?: string } = {};
    if (dto.name) {
      data.name = dto.name;
      data.slug = slugify(dto.name);
    }

    const updated = await this.categoriesRepository.update(id, data);
    return this.map(updated);
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) throw new NotFoundException('Category not found');

    const courseCount = await this.categoriesRepository.countCourses(id);
    if (courseCount > 0) {
      throw new ConflictException('Cannot delete a category that has courses assigned to it');
    }

    await this.categoriesRepository.delete(id);
  }

  private map(category: Category): CategoryResponseDto {
    return { id: category.id, name: category.name, slug: category.slug };
  }
}
