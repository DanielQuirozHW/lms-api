import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CourseModule, Lesson, Prisma } from '@prisma/client';
import type { CreateModuleDto } from './dto/create-module.dto';
import type {
  LessonSummaryDto,
  ModuleDetailResponseDto,
  ModuleResponseDto,
} from './dto/module-response.dto';
import type { ReorderModulesDto } from './dto/reorder-modules.dto';
import type { UpdateModuleDto } from './dto/update-module.dto';
import { type CourseModuleWithLessons, CourseModulesRepository } from './course-modules.repository';

@Injectable()
export class CourseModulesService {
  constructor(private readonly courseModulesRepository: CourseModulesRepository) {}

  /** Creates a module on a course. Order is auto-assigned to maxOrder + 1 if not provided. */
  async create(courseId: string, dto: CreateModuleDto): Promise<ModuleResponseDto> {
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.courseModulesRepository.getMaxOrder(courseId);
      order = maxOrder + 1;
    }
    const courseModule = await this.courseModulesRepository.create({
      title: dto.title,
      description: dto.description,
      order,
      unlockAfterDays: dto.unlockAfterDays ?? null,
      course: { connect: { id: courseId } },
    });
    return this.map(courseModule);
  }

  /** Returns all modules for a course. When publishedOnly is true, unpublished modules are hidden. */
  async findAll(courseId: string, publishedOnly: boolean): Promise<ModuleResponseDto[]> {
    const modules = await this.courseModulesRepository.findByCourseId(courseId, publishedOnly);
    return modules.map((m) => this.map(m));
  }

  /** Returns module with its lessons. Lessons filtered to published-only for students. Throws 404 if not found. */
  async findOne(id: string, publishedOnly: boolean): Promise<ModuleDetailResponseDto> {
    const courseModule = await this.courseModulesRepository.findByIdWithLessons(id, publishedOnly);
    if (!courseModule) throw new NotFoundException('Module not found');
    return this.mapDetail(courseModule);
  }

  /** Updates module fields. Throws 404 if module does not exist. */
  async update(moduleId: string, dto: UpdateModuleDto): Promise<ModuleResponseDto> {
    const existing = await this.courseModulesRepository.findById(moduleId);
    if (!existing) throw new NotFoundException('Module not found');
    const data: Prisma.CourseModuleUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.unlockAfterDays !== undefined && { unlockAfterDays: dto.unlockAfterDays }),
    };
    const courseModule = await this.courseModulesRepository.update(moduleId, data);
    return this.map(courseModule);
  }

  /** Transitions the module to published status. Throws 404 if module does not exist. */
  async publish(moduleId: string): Promise<ModuleResponseDto> {
    const existing = await this.courseModulesRepository.findById(moduleId);
    if (!existing) throw new NotFoundException('Module not found');
    const courseModule = await this.courseModulesRepository.update(moduleId, { isPublished: true });
    return this.map(courseModule);
  }

  /** Reorders modules by applying all order updates in a single transaction. */
  async reorder(dto: ReorderModulesDto): Promise<void> {
    await this.courseModulesRepository.reorder(dto.items);
  }

  /** Deletes a module. Throws 409 if the module has published lessons. Throws 404 if not found. */
  async remove(moduleId: string): Promise<void> {
    const existing = await this.courseModulesRepository.findById(moduleId);
    if (!existing) throw new NotFoundException('Module not found');
    const publishedLessons = await this.courseModulesRepository.countPublishedLessons(moduleId);
    if (publishedLessons > 0) {
      throw new ConflictException('Cannot delete a module that has published lessons');
    }
    await this.courseModulesRepository.delete(moduleId);
  }

  private map(courseModule: CourseModule): ModuleResponseDto {
    return {
      id: courseModule.id,
      courseId: courseModule.courseId,
      title: courseModule.title,
      description: courseModule.description,
      order: courseModule.order,
      isPublished: courseModule.isPublished,
      unlockAfterDays: courseModule.unlockAfterDays,
      createdAt: courseModule.createdAt,
      updatedAt: courseModule.updatedAt,
    };
  }

  private mapLesson(lesson: Lesson): LessonSummaryDto {
    return {
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      type: lesson.type,
      duration: lesson.duration,
      isPreview: lesson.isPreview,
      isPublished: lesson.isPublished,
    };
  }

  private mapDetail(courseModule: CourseModuleWithLessons): ModuleDetailResponseDto {
    return {
      id: courseModule.id,
      courseId: courseModule.courseId,
      title: courseModule.title,
      description: courseModule.description,
      order: courseModule.order,
      isPublished: courseModule.isPublished,
      unlockAfterDays: courseModule.unlockAfterDays,
      createdAt: courseModule.createdAt,
      updatedAt: courseModule.updatedAt,
      lessons: courseModule.lessons.map((l) => this.mapLesson(l)),
    };
  }
}
