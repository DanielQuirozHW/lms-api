import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Course } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CourseQueryDto } from './dto/course-query.dto';
import { type CourseWithCount, CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';

const mockCourse: Course = {
  id: 'course-123',
  title: 'TypeScript Basics',
  slug: 'typescript-basics',
  description: 'Learn TypeScript from scratch',
  coverUrl: null,
  status: 'DRAFT',
  price: null,
  instructorId: 'instructor-123',
  categoryId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockCourseWithCount: CourseWithCount = {
  ...mockCourse,
  lessonsCount: 5,
  enrollmentsCount: 10,
};

describe('CoursesService', () => {
  let service: CoursesService;
  let coursesRepository: jest.Mocked<
    Pick<
      CoursesRepository,
      | 'findMany'
      | 'findById'
      | 'findByIdWithCount'
      | 'countActiveEnrollments'
      | 'countLessons'
      | 'create'
      | 'update'
      | 'delete'
    >
  >;

  beforeEach(async () => {
    coursesRepository = {
      findMany: jest.fn(),
      findById: jest.fn(),
      findByIdWithCount: jest.fn(),
      countActiveEnrollments: jest.fn(),
      countLessons: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CoursesService, { provide: CoursesRepository, useValue: coursesRepository }],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates course with auto-generated slug and connects instructor', async () => {
      coursesRepository.create.mockResolvedValue(mockCourse);

      const result = await service.create('instructor-123', {
        title: 'TypeScript Basics',
        description: 'Learn TypeScript from scratch',
      });

      expect(coursesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'TypeScript Basics',
          slug: 'typescript-basics',
          instructor: { connect: { id: 'instructor-123' } },
        }),
      );
      expect(result.id).toBe('course-123');
      expect(result.slug).toBe('typescript-basics');
      expect(result).not.toHaveProperty('_count');
    });

    it('generates slug from title with special characters', async () => {
      coursesRepository.create.mockResolvedValue({ ...mockCourse, slug: 'node-js-with-express' });

      await service.create('instructor-123', { title: 'Node.js with Express!' });

      expect(coursesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'nodejs-with-express' }),
      );
    });
  });

  describe('findAll', () => {
    it('defaults to PUBLISHED status when no status filter is provided', async () => {
      coursesRepository.findMany.mockResolvedValue([[mockCourse], 1]);

      await service.findAll(new CourseQueryDto());

      expect(coursesRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PUBLISHED' }),
      );
    });

    it('always uses PUBLISHED status regardless of any query filter', async () => {
      coursesRepository.findMany.mockResolvedValue([[mockCourse], 1]);

      await service.findAll(new CourseQueryDto());

      expect(coursesRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PUBLISHED' }),
      );
    });

    it('returns paginated result with correct meta', async () => {
      coursesRepository.findMany.mockResolvedValue([[mockCourse], 1]);

      const result = await service.findAll(new CourseQueryDto());

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('returns course detail with lesson and enrollment counts', async () => {
      coursesRepository.findByIdWithCount.mockResolvedValue(mockCourseWithCount);

      const result = await service.findOne('course-123');

      expect(result.id).toBe('course-123');
      expect(result.lessonsCount).toBe(5);
      expect(result.enrollmentsCount).toBe(10);
    });

    it('throws NotFoundException when course does not exist', async () => {
      coursesRepository.findByIdWithCount.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMyCourses', () => {
    it('filters by instructorId without restricting status', async () => {
      coursesRepository.findMany.mockResolvedValue([[mockCourse], 1]);

      await service.findMyCourses('instructor-123', new PaginationDto());

      expect(coursesRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ instructorId: 'instructor-123' }),
      );
      const call = coursesRepository.findMany.mock.calls[0][0];
      expect(call.status).toBeUndefined();
    });
  });

  describe('publish', () => {
    it('updates course status to PUBLISHED when lessons exist', async () => {
      const published = { ...mockCourse, status: 'PUBLISHED' as const };
      coursesRepository.findById.mockResolvedValue(mockCourse);
      coursesRepository.countLessons.mockResolvedValue(3);
      coursesRepository.update.mockResolvedValue(published);

      const result = await service.publish('course-123');

      expect(coursesRepository.update).toHaveBeenCalledWith('course-123', { status: 'PUBLISHED' });
      expect(result.status).toBe('PUBLISHED');
    });

    it('throws NotFoundException when course does not exist', async () => {
      coursesRepository.findById.mockResolvedValue(null);

      await expect(service.publish('nonexistent')).rejects.toThrow(NotFoundException);
      expect(coursesRepository.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when course has no lessons', async () => {
      coursesRepository.findById.mockResolvedValue(mockCourse);
      coursesRepository.countLessons.mockResolvedValue(0);

      await expect(service.publish('course-123')).rejects.toThrow(BadRequestException);
      expect(coursesRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('updates course status to ARCHIVED', async () => {
      const archived = { ...mockCourse, status: 'ARCHIVED' as const };
      coursesRepository.update.mockResolvedValue(archived);

      const result = await service.archive('course-123');

      expect(coursesRepository.update).toHaveBeenCalledWith('course-123', {
        status: 'ARCHIVED',
      });
      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('remove', () => {
    it('throws ConflictException when course has active enrollments', async () => {
      coursesRepository.countActiveEnrollments.mockResolvedValue(3);

      await expect(service.remove('course-123')).rejects.toThrow(ConflictException);
      expect(coursesRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes course successfully when there are no active enrollments', async () => {
      coursesRepository.countActiveEnrollments.mockResolvedValue(0);
      coursesRepository.delete.mockResolvedValue(mockCourse);

      await service.remove('course-123');

      expect(coursesRepository.countActiveEnrollments).toHaveBeenCalledWith('course-123');
      expect(coursesRepository.delete).toHaveBeenCalledWith('course-123');
    });
  });
});
