import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CourseModule, Lesson } from '@prisma/client';
import { type CourseModuleWithLessons, CourseModulesRepository } from './course-modules.repository';
import { CourseModulesService } from './course-modules.service';

const mockModule: CourseModule = {
  id: 'module-123',
  courseId: 'course-123',
  title: 'Getting Started',
  description: null,
  order: 1,
  isPublished: false,
  unlockAfterDays: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockLesson: Lesson = {
  id: 'lesson-123',
  moduleId: 'module-123',
  title: 'Introduction',
  order: 1,
  type: 'TEXT',
  content: null,
  videoUrl: null,
  duration: null,
  isPreview: false,
  isPublished: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockModuleWithLessons: CourseModuleWithLessons = {
  ...mockModule,
  lessons: [mockLesson],
};

describe('CourseModulesService', () => {
  let service: CourseModulesService;
  let repo: jest.Mocked<
    Pick<
      CourseModulesRepository,
      | 'findByCourseId'
      | 'findById'
      | 'findByIdWithLessons'
      | 'getMaxOrder'
      | 'countPublishedLessons'
      | 'create'
      | 'update'
      | 'delete'
      | 'reorder'
      | 'findIdsByCourseId'
    >
  >;

  beforeEach(async () => {
    repo = {
      findByCourseId: jest.fn(),
      findById: jest.fn(),
      findByIdWithLessons: jest.fn(),
      getMaxOrder: jest.fn(),
      countPublishedLessons: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
      findIdsByCourseId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CourseModulesService, { provide: CourseModulesRepository, useValue: repo }],
    }).compile();

    service = module.get<CourseModulesService>(CourseModulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('auto-assigns order as maxOrder + 1 when order is not provided', async () => {
      repo.getMaxOrder.mockResolvedValue(2);
      repo.create.mockResolvedValue(mockModule);

      await service.create('course-123', { title: 'Getting Started' });

      expect(repo.getMaxOrder).toHaveBeenCalledWith('course-123');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 3, course: { connect: { id: 'course-123' } } }),
      );
    });

    it('uses provided order and skips getMaxOrder', async () => {
      repo.create.mockResolvedValue(mockModule);

      await service.create('course-123', { title: 'Getting Started', order: 5 });

      expect(repo.getMaxOrder).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ order: 5 }));
    });

    it('returns mapped response without internal fields', async () => {
      repo.getMaxOrder.mockResolvedValue(0);
      repo.create.mockResolvedValue(mockModule);

      const result = await service.create('course-123', { title: 'Getting Started' });

      expect(result.id).toBe('module-123');
      expect(result.courseId).toBe('course-123');
      expect(result).not.toHaveProperty('lessons');
    });
  });

  describe('findAll', () => {
    it('passes publishedOnly=false to repository for instructors', async () => {
      repo.findByCourseId.mockResolvedValue([mockModule]);

      await service.findAll('course-123', false);

      expect(repo.findByCourseId).toHaveBeenCalledWith('course-123', false);
    });

    it('passes publishedOnly=true to repository for students', async () => {
      repo.findByCourseId.mockResolvedValue([]);

      await service.findAll('course-123', true);

      expect(repo.findByCourseId).toHaveBeenCalledWith('course-123', true);
    });
  });

  describe('findOne', () => {
    it('returns module detail with lesson list', async () => {
      repo.findByIdWithLessons.mockResolvedValue(mockModuleWithLessons);

      const result = await service.findOne('module-123', false);

      expect(result.id).toBe('module-123');
      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0].id).toBe('lesson-123');
    });

    it('throws NotFoundException when module does not exist', async () => {
      repo.findByIdWithLessons.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', false)).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('sets isPublished to true', async () => {
      repo.findById.mockResolvedValue(mockModule);
      repo.update.mockResolvedValue({ ...mockModule, isPublished: true });

      const result = await service.publish('module-123');

      expect(repo.update).toHaveBeenCalledWith('module-123', { isPublished: true });
      expect(result.isPublished).toBe(true);
    });

    it('throws NotFoundException when module does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.publish('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('delegates all items to repository reorder in a transaction', async () => {
      repo.findIdsByCourseId.mockResolvedValue(['module-123', 'module-456']);
      repo.reorder.mockResolvedValue(undefined);

      await service.reorder('course-123', {
        items: [
          { id: 'module-123', order: 2 },
          { id: 'module-456', order: 1 },
        ],
      });

      expect(repo.reorder).toHaveBeenCalledWith([
        { id: 'module-123', order: 2 },
        { id: 'module-456', order: 1 },
      ]);
    });

    it('throws BadRequestException when an ID does not belong to the course', async () => {
      repo.findIdsByCourseId.mockResolvedValue(['module-123']);

      await expect(
        service.reorder('course-123', {
          items: [
            { id: 'module-123', order: 2 },
            { id: 'module-foreign', order: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.reorder).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when module does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(repo.countPublishedLessons).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when module has published lessons', async () => {
      repo.findById.mockResolvedValue(mockModule);
      repo.countPublishedLessons.mockResolvedValue(3);

      await expect(service.remove('module-123')).rejects.toThrow(ConflictException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes module successfully when there are no published lessons', async () => {
      repo.findById.mockResolvedValue(mockModule);
      repo.countPublishedLessons.mockResolvedValue(0);
      repo.delete.mockResolvedValue(mockModule);

      await service.remove('module-123');

      expect(repo.countPublishedLessons).toHaveBeenCalledWith('module-123');
      expect(repo.delete).toHaveBeenCalledWith('module-123');
    });
  });
});
