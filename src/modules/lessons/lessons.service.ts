import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AssignmentSettings,
  Lesson,
  LessonProgress,
  LessonResource,
  Prisma,
  QuizSettings,
} from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { CreateResourceDto } from './dto/create-resource.dto';
import type {
  LessonAssignmentSettingsDto,
  LessonDetailResponseDto,
  LessonProgressResponseDto,
  LessonQuizSettingsDto,
  LessonResourceDto,
  LessonResponseDto,
} from './dto/lesson-response.dto';
import type { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';
import type { UpdateProgressDto } from './dto/update-progress.dto';
import { type LessonWithDetails, LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(
    private readonly lessonsRepository: LessonsRepository,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /** Creates a lesson in a module. Verifies module belongs to courseId. Order auto-assigned to maxOrder + 1 if not provided. */
  async create(
    courseId: string,
    moduleId: string,
    dto: CreateLessonDto,
  ): Promise<LessonResponseDto> {
    const module = await this.lessonsRepository.findModuleByCourseId(moduleId, courseId);
    if (!module) throw new NotFoundException('Module not found');
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

  /** Returns all lessons in a module. Verifies module belongs to courseId. Unpublished hidden from students when publishedOnly is true.
   * For public access (publishedOnly=true), the course must be PUBLISHED (MISTAKES.md [007]).
   */
  async findAll(
    courseId: string,
    moduleId: string,
    publishedOnly: boolean,
  ): Promise<LessonResponseDto[]> {
    const module = await this.lessonsRepository.findModuleByCourseId(moduleId, courseId);
    if (!module) throw new NotFoundException('Module not found');
    if (publishedOnly) {
      const course = await this.lessonsRepository.findCourseStatus(courseId);
      if (!course || course.status !== 'PUBLISHED') throw new NotFoundException('Module not found');
    }
    const lessons = await this.lessonsRepository.findByModuleId(moduleId, publishedOnly);
    return lessons.map((l) => this.map(l));
  }

  /**
   * Returns lesson detail with resources and settings.
   * Students must be enrolled unless isPreview is true.
   * Unpublished lessons are returned as 404 for non-instructors.
   * BOLA guard: verifies lesson belongs to the moduleId and courseId from the URL.
   */
  async findOne(
    id: string,
    moduleId: string,
    courseId: string,
    user: AuthenticatedUser | undefined,
  ): Promise<LessonDetailResponseDto> {
    const lesson = await this.lessonsRepository.findByIdWithDetails(id);
    if (!lesson) throw new NotFoundException('Lesson not found');

    if (lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }

    const isInstructorOrAdmin = user?.roles.some(
      (r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN,
    );

    if (!isInstructorOrAdmin) {
      if (!lesson.isPublished) throw new NotFoundException('Lesson not found');
      // Also hide lessons from draft/archived courses (MISTAKES.md [007])
      const course = await this.lessonsRepository.findCourseStatus(courseId);
      if (!course || course.status !== 'PUBLISHED') throw new NotFoundException('Lesson not found');
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

  /** Updates lesson fields. Verifies lesson belongs to the given moduleId and courseId. Throws 404 if not found or mismatched. */
  async update(
    courseId: string,
    moduleId: string,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    const existing = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!existing || existing.moduleId !== moduleId || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
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

  /** Transitions the lesson to published status. Verifies lesson belongs to moduleId and courseId. Throws 404 if not found or mismatched. */
  async publish(courseId: string, moduleId: string, lessonId: string): Promise<LessonResponseDto> {
    const existing = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!existing || existing.moduleId !== moduleId || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
    const lesson = await this.lessonsRepository.update(lessonId, { isPublished: true });
    return this.map(lesson);
  }

  /** Reorders lessons. Validates all IDs belong to moduleId before updating. */
  async reorder(moduleId: string, dto: ReorderLessonsDto): Promise<void> {
    const existingIds = await this.lessonsRepository.findIdsByModuleId(moduleId);
    const existing = new Set(existingIds);
    if (dto.items.some((item) => !existing.has(item.id))) {
      throw new BadRequestException('One or more lesson IDs do not belong to this module');
    }
    await this.lessonsRepository.reorder(dto.items);
  }

  /**
   * Deletes a lesson. Throws 409 if the lesson is published and has student progress records.
   * Throws 404 if the lesson does not exist or does not belong to the given moduleId and courseId.
   */
  async remove(courseId: string, moduleId: string, lessonId: string): Promise<void> {
    const existing = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!existing || existing.moduleId !== moduleId || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
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

  /** Adds a downloadable or reference resource to a lesson. Verifies lesson belongs to moduleId and courseId. Throws 404 if not found or mismatched. */
  async addResource(
    courseId: string,
    moduleId: string,
    lessonId: string,
    dto: CreateResourceDto,
  ): Promise<LessonResourceDto> {
    const existing = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!existing || existing.moduleId !== moduleId || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
    const resource = await this.lessonsRepository.createResource({
      title: dto.title,
      url: dto.url,
      type: dto.type,
      lesson: { connect: { id: lessonId } },
    });
    return this.mapResource(resource);
  }

  /** Removes a resource from a lesson. Throws 404 if resource does not exist or does not belong to lessonId. */
  async removeResource(lessonId: string, resourceId: string): Promise<void> {
    const existing = await this.lessonsRepository.findResourceById(resourceId, lessonId);
    if (!existing) throw new NotFoundException('Resource not found');
    await this.lessonsRepository.deleteResource(resourceId);
  }

  /** Updates the calling student's progress on a lesson. Sets startedAt on first view, tracks watchedSeconds, and marks completed. If sequential course, unlocks next lesson on completion. */
  async updateProgress(
    courseId: string,
    moduleId: string,
    lessonId: string,
    dto: UpdateProgressDto,
    user: AuthenticatedUser,
  ): Promise<LessonProgressResponseDto> {
    const lesson = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }

    const enrollment = await this.lessonsRepository.findActiveEnrollmentId(user.id, courseId);
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');

    const now = new Date();
    const existing = await this.lessonsRepository.findLessonProgress(enrollment.id, lessonId);
    const isFirstCompletion = !!dto.completed && !existing?.completedAt;

    const createData = {
      startedAt: now,
      ...(dto.watchedSeconds !== undefined && {
        watchedSeconds: dto.watchedSeconds,
        lastWatchedAt: now,
      }),
      ...(isFirstCompletion && { completedAt: now }),
    };

    const updateData = {
      ...(dto.watchedSeconds !== undefined && {
        watchedSeconds: dto.watchedSeconds,
        lastWatchedAt: now,
      }),
      ...(isFirstCompletion && { completedAt: now }),
    };

    const progress = await this.lessonsRepository.upsertLessonProgress(
      enrollment.id,
      lessonId,
      createData,
      updateData,
    );

    if (isFirstCompletion) {
      const isSequential = await this.lessonsRepository.findCourseIsSequential(courseId);
      if (isSequential) {
        const nextLesson = await this.lessonsRepository.findNextPublishedLesson(
          lessonId,
          moduleId,
          courseId,
        );
        if (nextLesson) {
          await this.lessonsRepository.unlockLessonProgress(enrollment.id, nextLesson.id);
        }
      }
      await this.enrollmentsService.checkAndCompleteCourse(enrollment.id);
    }

    return this.mapProgress(progress);
  }

  /** Returns the courseId for the given lesson. Used by UploadService to verify instructor ownership before generating presigned upload URLs. */
  async getLessonCourseId(lessonId: string): Promise<string> {
    const lesson = await this.lessonsRepository.findByIdWithModule(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson.module.courseId;
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

  private mapQuizSettings(qs: QuizSettings): LessonQuizSettingsDto {
    return {
      id: qs.id,
      lessonId: qs.lessonId,
      maxAttempts: qs.maxAttempts,
      passingScore: qs.passingScore,
      blocksProgress: qs.blocksProgress,
      shuffleQuestions: qs.shuffleQuestions,
    };
  }

  private mapAssignmentSettings(as: AssignmentSettings): LessonAssignmentSettingsDto {
    return {
      id: as.id,
      lessonId: as.lessonId,
      gradingType: as.gradingType,
      maxScore: as.maxScore,
      passingScore: as.passingScore,
      dueDate: as.dueDate,
      allowLateSubmission: as.allowLateSubmission,
      isGroupAssignment: as.isGroupAssignment,
      groupId: as.groupId,
      maxAttempts: as.maxAttempts,
    };
  }

  private mapProgress(progress: LessonProgress): LessonProgressResponseDto {
    return {
      id: progress.id,
      enrollmentId: progress.enrollmentId,
      lessonId: progress.lessonId,
      isLocked: progress.isLocked,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      lastWatchedAt: progress.lastWatchedAt,
      watchedSeconds: progress.watchedSeconds,
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
