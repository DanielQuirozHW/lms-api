import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignmentSettings,
  Lesson,
  LessonResource,
  Prisma,
  QuizSettings,
} from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { CreateResourceDto } from './dto/create-resource.dto';
import type {
  AssignmentSettingsDto,
  LessonDetailResponseDto,
  LessonResourceDto,
  LessonResponseDto,
  QuizSettingsDto,
} from './dto/lesson-response.dto';
import type { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';
import { type LessonWithDetails, LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(private readonly lessonsRepository: LessonsRepository) {}

  /** Creates a lesson in a module. Order auto-assigned to maxOrder + 1 if not provided. */
  async create(moduleId: string, dto: CreateLessonDto): Promise<LessonResponseDto> {
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.lessonsRepository.getMaxOrder(moduleId);
      order = maxOrder + 1;
    }
    const lesson = await this.lessonsRepository.create({
      title: dto.title,
      type: dto.type,
      order,
      content: dto.content ?? null,
      videoUrl: dto.videoUrl ?? null,
      duration: dto.duration ?? null,
      isPreview: dto.isPreview ?? false,
      module: { connect: { id: moduleId } },
    });
    return this.map(lesson);
  }

  /** Returns all lessons in a module. Unpublished hidden from students when publishedOnly is true. */
  async findAll(moduleId: string, publishedOnly: boolean): Promise<LessonResponseDto[]> {
    const lessons = await this.lessonsRepository.findByModuleId(moduleId, publishedOnly);
    return lessons.map((l) => this.map(l));
  }

  /**
   * Returns lesson detail with resources and settings.
   * Students must be enrolled unless isPreview is true.
   * Unpublished lessons are returned as 404 for non-instructors.
   */
  async findOne(
    id: string,
    courseId: string,
    user: AuthenticatedUser | undefined,
  ): Promise<LessonDetailResponseDto> {
    const lesson = await this.lessonsRepository.findByIdWithDetails(id);
    if (!lesson) throw new NotFoundException('Lesson not found');

    const isInstructorOrAdmin = user?.roles.some(
      (r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN,
    );

    if (!isInstructorOrAdmin) {
      if (!lesson.isPublished) throw new NotFoundException('Lesson not found');
      if (!lesson.isPreview) {
        if (!user) throw new ForbiddenException('Authentication required to access this lesson');
        const enrolled = await this.lessonsRepository.isEnrolled(user.id, courseId);
        if (!enrolled) {
          throw new ForbiddenException('You must be enrolled in this course to access this lesson');
        }
      }
    }

    return this.mapDetail(lesson);
  }

  /** Updates lesson fields. Throws 404 if lesson does not exist. */
  async update(lessonId: string, dto: UpdateLessonDto): Promise<LessonResponseDto> {
    const existing = await this.lessonsRepository.findById(lessonId);
    if (!existing) throw new NotFoundException('Lesson not found');
    const data: Prisma.LessonUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.order !== undefined && { order: dto.order }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
      ...(dto.duration !== undefined && { duration: dto.duration }),
      ...(dto.isPreview !== undefined && { isPreview: dto.isPreview }),
    };
    const lesson = await this.lessonsRepository.update(lessonId, data);
    return this.map(lesson);
  }

  /** Transitions the lesson to published status. Throws 404 if lesson does not exist. */
  async publish(lessonId: string): Promise<LessonResponseDto> {
    const existing = await this.lessonsRepository.findById(lessonId);
    if (!existing) throw new NotFoundException('Lesson not found');
    const lesson = await this.lessonsRepository.update(lessonId, { isPublished: true });
    return this.map(lesson);
  }

  /** Reorders lessons by applying all order updates in a single transaction. */
  async reorder(dto: ReorderLessonsDto): Promise<void> {
    await this.lessonsRepository.reorder(dto.items);
  }

  /**
   * Deletes a lesson. Throws 409 if the lesson is published and has student progress records.
   * Throws 404 if the lesson does not exist.
   */
  async remove(lessonId: string): Promise<void> {
    const existing = await this.lessonsRepository.findById(lessonId);
    if (!existing) throw new NotFoundException('Lesson not found');
    if (existing.isPublished) {
      const progressCount = await this.lessonsRepository.countProgress(lessonId);
      if (progressCount > 0) {
        throw new ConflictException(
          'Cannot delete a published lesson that has student progress records',
        );
      }
    }
    await this.lessonsRepository.delete(lessonId);
  }

  /** Adds a downloadable or reference resource to a lesson. Throws 404 if lesson does not exist. */
  async addResource(lessonId: string, dto: CreateResourceDto): Promise<LessonResourceDto> {
    const existing = await this.lessonsRepository.findById(lessonId);
    if (!existing) throw new NotFoundException('Lesson not found');
    const resource = await this.lessonsRepository.createResource({
      title: dto.title,
      url: dto.url,
      type: dto.type,
      lesson: { connect: { id: lessonId } },
    });
    return this.mapResource(resource);
  }

  /** Removes a resource from a lesson. Throws 404 if resource does not exist. */
  async removeResource(resourceId: string): Promise<void> {
    const existing = await this.lessonsRepository.findResourceById(resourceId);
    if (!existing) throw new NotFoundException('Resource not found');
    await this.lessonsRepository.deleteResource(resourceId);
  }

  private map(lesson: Lesson): LessonResponseDto {
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      title: lesson.title,
      order: lesson.order,
      type: lesson.type,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      duration: lesson.duration,
      isPreview: lesson.isPreview,
      isPublished: lesson.isPublished,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }

  private mapResource(resource: LessonResource): LessonResourceDto {
    return {
      id: resource.id,
      title: resource.title,
      url: resource.url,
      type: resource.type,
      createdAt: resource.createdAt,
    };
  }

  private mapQuizSettings(qs: QuizSettings): QuizSettingsDto {
    return {
      id: qs.id,
      maxAttempts: qs.maxAttempts,
      passingScore: qs.passingScore,
      blocksProgress: qs.blocksProgress,
      shuffleQuestions: qs.shuffleQuestions,
    };
  }

  private mapAssignmentSettings(as: AssignmentSettings): AssignmentSettingsDto {
    return {
      id: as.id,
      gradingType: as.gradingType,
      maxScore: as.maxScore,
      passingScore: as.passingScore,
      dueDate: as.dueDate,
      allowLateSubmission: as.allowLateSubmission,
    };
  }

  private mapDetail(lesson: LessonWithDetails): LessonDetailResponseDto {
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      title: lesson.title,
      order: lesson.order,
      type: lesson.type,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      duration: lesson.duration,
      isPreview: lesson.isPreview,
      isPublished: lesson.isPublished,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
      resources: lesson.resources.map((r) => this.mapResource(r)),
      quizSettings: lesson.quizSettings ? this.mapQuizSettings(lesson.quizSettings) : null,
      assignmentSettings: lesson.assignmentSettings
        ? this.mapAssignmentSettings(lesson.assignmentSettings)
        : null,
    };
  }
}
