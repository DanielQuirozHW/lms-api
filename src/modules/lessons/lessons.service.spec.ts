import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Lesson, LessonResource } from '@prisma/client';
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
      | 'findById'
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
    >
  >;

  beforeEach(async () => {
    repo = {
      findByModuleId: jest.fn(),
      findById: jest.fn(),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LessonsService, { provide: LessonsRepository, useValue: repo }],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a VIDEO lesson with videoUrl and auto-assigned order', async () => {
      repo.getMaxOrder.mockResolvedValue(0);
      repo.create.mockResolvedValue(mockLesson);

      const result = await service.create('module-123', {
        title: 'Introduction to Variables',
        type: 'VIDEO',
        videoUrl: 'https://cdn.example.com/video.mp4',
      });

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
      const quizLesson: Lesson = { ...mockLesson, type: 'QUIZ', videoUrl: null, order: 3 };
      repo.create.mockResolvedValue(quizLesson);

      await service.create('module-123', { title: 'Chapter Quiz', type: 'QUIZ', order: 3 });

      expect(repo.getMaxOrder).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'QUIZ', order: 3, videoUrl: null }),
      );
    });
  });

  describe('findAll', () => {
    it('passes publishedOnly=false for instructors', async () => {
      repo.findByModuleId.mockResolvedValue([mockLesson]);

      await service.findAll('module-123', false);

      expect(repo.findByModuleId).toHaveBeenCalledWith('module-123', false);
    });

    it('passes publishedOnly=true for students', async () => {
      repo.findByModuleId.mockResolvedValue([]);

      await service.findAll('module-123', true);

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
      repo.findById.mockResolvedValue(mockLesson);
      repo.update.mockResolvedValue({ ...mockLesson, isPublished: true });

      const result = await service.publish('lesson-123');

      expect(repo.update).toHaveBeenCalledWith('lesson-123', { isPublished: true });
      expect(result.isPublished).toBe(true);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.publish('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when published lesson has student progress records', async () => {
      repo.findById.mockResolvedValue({ ...mockLesson, isPublished: true });
      repo.countProgress.mockResolvedValue(5);

      await expect(service.remove('lesson-123')).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes unpublished lesson without checking progress', async () => {
      repo.findById.mockResolvedValue({ ...mockLesson, isPublished: false });
      repo.delete.mockResolvedValue(mockLesson);

      await service.remove('lesson-123');

      expect(repo.countProgress).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith('lesson-123');
    });

    it('deletes published lesson when there are no progress records', async () => {
      repo.findById.mockResolvedValue({ ...mockLesson, isPublished: true });
      repo.countProgress.mockResolvedValue(0);
      repo.delete.mockResolvedValue(mockLesson);

      await service.remove('lesson-123');

      expect(repo.countProgress).toHaveBeenCalledWith('lesson-123');
      expect(repo.delete).toHaveBeenCalledWith('lesson-123');
    });
  });

  describe('addResource', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.addResource('nonexistent', {
          title: 'Slides',
          url: 'https://example.com/s.pdf',
          type: 'pdf',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates and returns the resource', async () => {
      repo.findById.mockResolvedValue(mockLesson);
      repo.createResource.mockResolvedValue(mockResource);

      const result = await service.addResource('lesson-123', {
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
});
