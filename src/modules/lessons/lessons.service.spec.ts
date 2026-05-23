import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Lesson, LessonProgress, LessonResource } from '@prisma/client';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { type LessonWithDetails, LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';

const mockLesson: Lesson = {
  id: 'lesson-123',
  moduleId: 'module-123',
  title: 'Introduction to Variables',
  order: 1,
  type: 'VIDEO',
  content: null,
  videoUrl: 'https://cdn.example.com/video.mp4',
  duration: 480,
  isPreview: false,
  isPublished: false,
  rubricId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockResource: LessonResource = {
  id: 'resource-123',
  lessonId: 'lesson-123',
  title: 'Course Slides',
  url: 'https://example.com/slides.pdf',
  type: 'pdf',
  createdAt: new Date('2024-01-01'),
};

const mockLessonWithDetails: LessonWithDetails = {
  ...mockLesson,
  resources: [],
  quizSettings: null,
  assignmentSettings: null,
  module: { courseId: 'course-123' },
};

const instructor = {
  id: 'instructor-123',
  email: 'inst@example.com',
  roles: ['INSTRUCTOR' as const],
};
const student = { id: 'student-123', email: 'stu@example.com', roles: ['STUDENT' as const] };

describe('LessonsService', () => {
  let service: LessonsService;
  let repo: jest.Mocked<
    Pick<
      LessonsRepository,
      | 'findByModuleId'
      | 'findByIdWithModule'
      | 'findModuleByCourseId'
      | 'findByIdWithDetails'
      | 'findIdsByModuleId'
      | 'getMaxOrder'
      | 'countProgress'
      | 'isEnrolled'
      | 'create'
      | 'update'
      | 'delete'
      | 'reorder'
      | 'createResource'
      | 'findResourceById'
      | 'deleteResource'
      | 'findActiveEnrollmentId'
      | 'findLessonProgress'
      | 'upsertLessonProgress'
      | 'findCourseIsSequential'
      | 'findNextPublishedLesson'
      | 'unlockLessonProgress'
    >
  >;
  let enrollmentsSvc: jest.Mocked<Pick<EnrollmentsService, 'checkAndCompleteCourse'>>;

  beforeEach(async () => {
    repo = {
      findByModuleId: jest.fn(),
      findByIdWithModule: jest.fn(),
      findModuleByCourseId: jest.fn(),
      findByIdWithDetails: jest.fn(),
      findIdsByModuleId: jest.fn(),
      getMaxOrder: jest.fn(),
      countProgress: jest.fn(),
      isEnrolled: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
      createResource: jest.fn(),
      findResourceById: jest.fn(),
      deleteResource: jest.fn(),
      findActiveEnrollmentId: jest.fn(),
      findLessonProgress: jest.fn(),
      upsertLessonProgress: jest.fn(),
      findCourseIsSequential: jest.fn(),
      findNextPublishedLesson: jest.fn(),
      unlockLessonProgress: jest.fn(),
    };
    enrollmentsSvc = { checkAndCompleteCourse: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: LessonsRepository, useValue: repo },
        { provide: EnrollmentsService, useValue: enrollmentsSvc },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a VIDEO lesson with videoUrl and auto-assigned order', async () => {
      repo.findModuleByCourseId.mockResolvedValue({ id: 'module-123' });
      repo.getMaxOrder.mockResolvedValue(0);
      repo.create.mockResolvedValue(mockLesson);

      const result = await service.create('course-123', 'module-123', {
        title: 'Introduction to Variables',
        type: 'VIDEO',
        videoUrl: 'https://cdn.example.com/video.mp4',
      });

      expect(repo.findModuleByCourseId).toHaveBeenCalledWith('module-123', 'course-123');
      expect(repo.getMaxOrder).toHaveBeenCalledWith('module-123');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Introduction to Variables',
          type: 'VIDEO',
          order: 1,
          videoUrl: 'https://cdn.example.com/video.mp4',
          module: { connect: { id: 'module-123' } },
        }),
      );
      expect(result.id).toBe('lesson-123');
      expect(result).not.toHaveProperty('resources');
    });

    it('creates a QUIZ lesson without videoUrl and uses provided order', async () => {
      repo.findModuleByCourseId.mockResolvedValue({ id: 'module-123' });
      const quizLesson: Lesson = { ...mockLesson, type: 'QUIZ', videoUrl: null, order: 3 };
      repo.create.mockResolvedValue(quizLesson);

      await service.create('course-123', 'module-123', {
        title: 'Chapter Quiz',
        type: 'QUIZ',
        order: 3,
      });

      expect(repo.getMaxOrder).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'QUIZ', order: 3, videoUrl: null }),
      );
    });
  });

  describe('findAll', () => {
    it('passes publishedOnly=false for instructors', async () => {
      repo.findModuleByCourseId.mockResolvedValue({ id: 'module-123' });
      repo.findByModuleId.mockResolvedValue([mockLesson]);

      await service.findAll('course-123', 'module-123', false);

      expect(repo.findByModuleId).toHaveBeenCalledWith('module-123', false);
    });

    it('passes publishedOnly=true for students', async () => {
      repo.findModuleByCourseId.mockResolvedValue({ id: 'module-123' });
      repo.findByModuleId.mockResolvedValue([]);

      await service.findAll('course-123', 'module-123', true);

      expect(repo.findByModuleId).toHaveBeenCalledWith('module-123', true);
    });
  });

  describe('findOne', () => {
    it('returns lesson detail for instructor even when unpublished', async () => {
      repo.findByIdWithDetails.mockResolvedValue({ ...mockLessonWithDetails, isPublished: false });

      const result = await service.findOne('lesson-123', 'module-123', 'course-123', instructor);

      expect(result.id).toBe('lesson-123');
      expect(result.resources).toHaveLength(0);
      expect(repo.isEnrolled).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for students when lesson is not published', async () => {
      repo.findByIdWithDetails.mockResolvedValue({ ...mockLessonWithDetails, isPublished: false });

      await expect(
        service.findOne('lesson-123', 'module-123', 'course-123', student),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when lesson does not belong to the given module (BOLA guard)', async () => {
      repo.findByIdWithDetails.mockResolvedValue({
        ...mockLessonWithDetails,
        moduleId: 'different-module',
      });

      await expect(
        service.findOne('lesson-123', 'module-123', 'course-123', instructor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when module does not belong to the given course (BOLA guard)', async () => {
      repo.findByIdWithDetails.mockResolvedValue({
        ...mockLessonWithDetails,
        module: { courseId: 'different-course' },
      });

      await expect(
        service.findOne('lesson-123', 'module-123', 'course-123', instructor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when student is not enrolled in a non-preview lesson', async () => {
      repo.findByIdWithDetails.mockResolvedValue({
        ...mockLessonWithDetails,
        isPublished: true,
        isPreview: false,
      });
      repo.isEnrolled.mockResolvedValue(false);

      await expect(
        service.findOne('lesson-123', 'module-123', 'course-123', student),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.isEnrolled).toHaveBeenCalledWith('student-123', 'course-123');
    });

    it('allows access to preview lessons without authentication', async () => {
      repo.findByIdWithDetails.mockResolvedValue({
        ...mockLessonWithDetails,
        isPublished: true,
        isPreview: true,
      });

      const result = await service.findOne('lesson-123', 'module-123', 'course-123', undefined);

      expect(result.id).toBe('lesson-123');
      expect(repo.isEnrolled).not.toHaveBeenCalled();
    });

    it('allows enrolled student to access a non-preview lesson', async () => {
      repo.findByIdWithDetails.mockResolvedValue({
        ...mockLessonWithDetails,
        isPublished: true,
        isPreview: false,
      });
      repo.isEnrolled.mockResolvedValue(true);

      const result = await service.findOne('lesson-123', 'module-123', 'course-123', student);

      expect(result.id).toBe('lesson-123');
    });
  });

  describe('publish', () => {
    it('sets isPublished to true', async () => {
      repo.findByIdWithModule.mockResolvedValue({
        ...mockLesson,
        module: { courseId: 'course-123' },
      });
      repo.update.mockResolvedValue({ ...mockLesson, isPublished: true });

      const result = await service.publish('course-123', 'module-123', 'lesson-123');

      expect(repo.update).toHaveBeenCalledWith('lesson-123', { isPublished: true });
      expect(result.isPublished).toBe(true);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findByIdWithModule.mockResolvedValue(null);

      await expect(service.publish('course-123', 'module-123', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findByIdWithModule.mockResolvedValue(null);

      await expect(service.remove('course-123', 'module-123', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when published lesson has student progress records', async () => {
      repo.findByIdWithModule.mockResolvedValue({
        ...mockLesson,
        isPublished: true,
        module: { courseId: 'course-123' },
      });
      repo.countProgress.mockResolvedValue(5);

      await expect(service.remove('course-123', 'module-123', 'lesson-123')).rejects.toThrow(
        ConflictException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes unpublished lesson without checking progress', async () => {
      repo.findByIdWithModule.mockResolvedValue({
        ...mockLesson,
        isPublished: false,
        module: { courseId: 'course-123' },
      });
      repo.delete.mockResolvedValue(mockLesson);

      await service.remove('course-123', 'module-123', 'lesson-123');

      expect(repo.countProgress).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith('lesson-123');
    });

    it('deletes published lesson when there are no progress records', async () => {
      repo.findByIdWithModule.mockResolvedValue({
        ...mockLesson,
        isPublished: true,
        module: { courseId: 'course-123' },
      });
      repo.countProgress.mockResolvedValue(0);
      repo.delete.mockResolvedValue(mockLesson);

      await service.remove('course-123', 'module-123', 'lesson-123');

      expect(repo.countProgress).toHaveBeenCalledWith('lesson-123');
      expect(repo.delete).toHaveBeenCalledWith('lesson-123');
    });
  });

  describe('addResource', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findByIdWithModule.mockResolvedValue(null);

      await expect(
        service.addResource('course-123', 'module-123', 'nonexistent', {
          title: 'Slides',
          url: 'https://example.com/s.pdf',
          type: 'pdf',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates and returns the resource', async () => {
      repo.findByIdWithModule.mockResolvedValue({
        ...mockLesson,
        module: { courseId: 'course-123' },
      });
      repo.createResource.mockResolvedValue(mockResource);

      const result = await service.addResource('course-123', 'module-123', 'lesson-123', {
        title: 'Course Slides',
        url: 'https://example.com/slides.pdf',
        type: 'pdf',
      });

      expect(repo.createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Course Slides',
          lesson: { connect: { id: 'lesson-123' } },
        }),
      );
      expect(result.id).toBe('resource-123');
    });
  });

  describe('removeResource', () => {
    it('throws NotFoundException when resource does not exist or does not belong to lesson', async () => {
      repo.findResourceById.mockResolvedValue(null);

      await expect(service.removeResource('lesson-123', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.deleteResource).not.toHaveBeenCalled();
    });

    it('deletes resource successfully when it belongs to the lesson', async () => {
      repo.findResourceById.mockResolvedValue(mockResource);
      repo.deleteResource.mockResolvedValue(mockResource);

      await service.removeResource('lesson-123', 'resource-123');

      expect(repo.findResourceById).toHaveBeenCalledWith('resource-123', 'lesson-123');
      expect(repo.deleteResource).toHaveBeenCalledWith('resource-123');
    });
  });

  describe('updateProgress', () => {
    const lessonWithModule = { ...mockLesson, module: { courseId: 'course-123' } };
    const mockProgress: LessonProgress = {
      id: 'progress-1',
      enrollmentId: 'enrollment-1',
      lessonId: 'lesson-123',
      isLocked: false,
      startedAt: new Date('2026-01-01'),
      completedAt: null,
      lastWatchedAt: null,
      watchedSeconds: null,
    };

    it('throws NotFoundException when lesson does not belong to module/course', async () => {
      repo.findByIdWithModule.mockResolvedValue(null);

      await expect(
        service.updateProgress(
          'course-123',
          'module-123',
          'lesson-123',
          {},
          {
            id: 'student-1',
            email: 's@test.com',
            roles: ['STUDENT'],
          },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when student is not enrolled', async () => {
      repo.findByIdWithModule.mockResolvedValue(lessonWithModule);
      repo.findActiveEnrollmentId.mockResolvedValue(null);

      await expect(
        service.updateProgress(
          'course-123',
          'module-123',
          'lesson-123',
          {},
          {
            id: 'student-1',
            email: 's@test.com',
            roles: ['STUDENT'],
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets startedAt on first view and updates watchedSeconds', async () => {
      repo.findByIdWithModule.mockResolvedValue(lessonWithModule);
      repo.findActiveEnrollmentId.mockResolvedValue({ id: 'enrollment-1' });
      repo.findLessonProgress.mockResolvedValue(null);
      repo.upsertLessonProgress.mockResolvedValue({ ...mockProgress, watchedSeconds: 60 });

      const result = await service.updateProgress(
        'course-123',
        'module-123',
        'lesson-123',
        { watchedSeconds: 60 },
        { id: 'student-1', email: 's@test.com', roles: ['STUDENT'] },
      );

      expect(repo.upsertLessonProgress).toHaveBeenCalledWith(
        'enrollment-1',
        'lesson-123',
        expect.objectContaining({
          startedAt: expect.any(Date) as unknown,
          watchedSeconds: 60,
        }) as unknown,
        expect.objectContaining({ watchedSeconds: 60 }) as unknown,
      );
      expect(result.watchedSeconds).toBe(60);
    });

    it('marks lesson completed and calls checkAndCompleteCourse', async () => {
      repo.findByIdWithModule.mockResolvedValue(lessonWithModule);
      repo.findActiveEnrollmentId.mockResolvedValue({ id: 'enrollment-1' });
      repo.findLessonProgress.mockResolvedValue(null);
      repo.upsertLessonProgress.mockResolvedValue({
        ...mockProgress,
        completedAt: new Date(),
      });
      repo.findCourseIsSequential.mockResolvedValue(false);

      await service.updateProgress(
        'course-123',
        'module-123',
        'lesson-123',
        { completed: true },
        { id: 'student-1', email: 's@test.com', roles: ['STUDENT'] },
      );

      expect(repo.upsertLessonProgress).toHaveBeenCalledWith(
        'enrollment-1',
        'lesson-123',
        expect.objectContaining({ completedAt: expect.any(Date) as unknown }) as unknown,
        expect.objectContaining({ completedAt: expect.any(Date) as unknown }) as unknown,
      );
      expect(enrollmentsSvc.checkAndCompleteCourse).toHaveBeenCalledWith('enrollment-1');
    });

    it('unlocks next lesson on completion when course is sequential', async () => {
      repo.findByIdWithModule.mockResolvedValue(lessonWithModule);
      repo.findActiveEnrollmentId.mockResolvedValue({ id: 'enrollment-1' });
      repo.findLessonProgress.mockResolvedValue(null);
      repo.upsertLessonProgress.mockResolvedValue({ ...mockProgress, completedAt: new Date() });
      repo.findCourseIsSequential.mockResolvedValue(true);
      repo.findNextPublishedLesson.mockResolvedValue({ id: 'lesson-next' });
      repo.unlockLessonProgress.mockResolvedValue(undefined);

      await service.updateProgress(
        'course-123',
        'module-123',
        'lesson-123',
        { completed: true },
        { id: 'student-1', email: 's@test.com', roles: ['STUDENT'] },
      );

      expect(repo.findNextPublishedLesson).toHaveBeenCalledWith(
        'lesson-123',
        'module-123',
        'course-123',
      );
      expect(repo.unlockLessonProgress).toHaveBeenCalledWith('enrollment-1', 'lesson-next');
    });

    it('does not re-complete or re-unlock when lesson is already completed', async () => {
      repo.findByIdWithModule.mockResolvedValue(lessonWithModule);
      repo.findActiveEnrollmentId.mockResolvedValue({ id: 'enrollment-1' });
      repo.findLessonProgress.mockResolvedValue({ ...mockProgress, completedAt: new Date() });
      repo.upsertLessonProgress.mockResolvedValue({ ...mockProgress, completedAt: new Date() });

      await service.updateProgress(
        'course-123',
        'module-123',
        'lesson-123',
        { completed: true },
        { id: 'student-1', email: 's@test.com', roles: ['STUDENT'] },
      );

      expect(enrollmentsSvc.checkAndCompleteCourse).not.toHaveBeenCalled();
      expect(repo.unlockLessonProgress).not.toHaveBeenCalled();
    });
  });
});
