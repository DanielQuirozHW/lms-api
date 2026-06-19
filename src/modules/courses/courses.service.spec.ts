import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Course } from '@prisma/client';
import { EnrollmentType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CourseQueryDto } from './dto/course-query.dto';
import {
  type CourseForDuplicate,
  type CourseWithCount,
  CoursesRepository,
} from './courses.repository';
import { CoursesService } from './courses.service';

const mockCourse: Course = {
  id: 'course-123',
  title: 'TypeScript Basics',
  slug: 'typescript-basics',
  description: 'Learn TypeScript from scratch',
  coverUrl: null,
  status: 'DRAFT',
  enrollmentType: EnrollmentType.FREE,
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
      | 'findBySlug'
      | 'findBySlugWithCount'
      | 'findByIdForDuplicate'
      | 'duplicateCourse'
      | 'countNonCancelledEnrollments'
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
      findBySlug: jest.fn().mockResolvedValue(null),
      findBySlugWithCount: jest.fn().mockResolvedValue(null),
      findByIdForDuplicate: jest.fn(),
      duplicateCourse: jest.fn(),
      countNonCancelledEnrollments: jest.fn(),
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
    it('returns course detail for a PUBLISHED course without user context', async () => {
      const publishedCourse = { ...mockCourseWithCount, status: 'PUBLISHED' as const };
      coursesRepository.findByIdWithCount.mockResolvedValue(publishedCourse);

      const result = await service.findOne('course-123');

      expect(result.id).toBe('course-123');
      expect(result.lessonsCount).toBe(5);
      expect(result.enrollmentsCount).toBe(10);
    });

    it('returns course detail for a non-PUBLISHED course when caller is the owner', async () => {
      coursesRepository.findByIdWithCount.mockResolvedValue(mockCourseWithCount);
      const owner = { id: 'instructor-123', email: 'i@test.com', roles: ['INSTRUCTOR' as const] };

      const result = await service.findOne('course-123', owner);

      expect(result.id).toBe('course-123');
    });

    it('throws NotFoundException for non-PUBLISHED course when caller is not owner or admin', async () => {
      coursesRepository.findByIdWithCount.mockResolvedValue(mockCourseWithCount);

      await expect(service.findOne('course-123')).rejects.toThrow(NotFoundException);
    });

    it('falls back to slug lookup when ID lookup returns null', async () => {
      const publishedCourse = { ...mockCourseWithCount, status: 'PUBLISHED' as const };
      coursesRepository.findByIdWithCount.mockResolvedValue(null);
      coursesRepository.findBySlugWithCount.mockResolvedValue(publishedCourse);

      const result = await service.findOne('typescript-basics');

      expect(coursesRepository.findByIdWithCount).toHaveBeenCalledWith('typescript-basics');
      expect(coursesRepository.findBySlugWithCount).toHaveBeenCalledWith('typescript-basics');
      expect(result.id).toBe('course-123');
    });

    it('throws NotFoundException when neither ID nor slug matches', async () => {
      coursesRepository.findByIdWithCount.mockResolvedValue(null);
      // findBySlugWithCount defaults to null

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
    it('throws ConflictException when course has non-cancelled enrollments', async () => {
      coursesRepository.countNonCancelledEnrollments.mockResolvedValue(3);

      await expect(service.remove('course-123')).rejects.toThrow(ConflictException);
      expect(coursesRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes course successfully when all enrollments are cancelled', async () => {
      coursesRepository.countNonCancelledEnrollments.mockResolvedValue(0);
      coursesRepository.delete.mockResolvedValue(mockCourse);

      await service.remove('course-123');

      expect(coursesRepository.countNonCancelledEnrollments).toHaveBeenCalledWith('course-123');
      expect(coursesRepository.delete).toHaveBeenCalledWith('course-123');
    });
  });

  describe('duplicate', () => {
    const baseLesson = {
      id: 'lesson-001',
      moduleId: 'module-001',
      title: 'What is TypeScript?',
      order: 1,
      type: 'TEXT' as const,
      content: 'TS is typed JS.',
      videoUrl: null,
      duration: null,
      readingTime: null,
      isPreview: false,
      isPublished: true,
      rubricId: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const lessonWithQuiz = {
      ...baseLesson,
      id: 'lesson-002',
      title: 'Quiz Lesson',
      quizSettings: {
        id: 'qs-001',
        lessonId: 'lesson-002',
        maxAttempts: 3,
        passingScore: 70,
        blocksProgress: true,
        shuffleQuestions: false,
      },
      questions: [
        {
          id: 'q-001',
          lessonId: 'lesson-002',
          text: 'What is TypeScript?',
          type: 'SINGLE_CHOICE' as const,
          order: 1,
          points: 10,
          options: [
            {
              id: 'opt-1',
              questionId: 'q-001',
              text: 'A typed superset of JS',
              order: 1,
              isCorrect: true,
            },
            { id: 'opt-2', questionId: 'q-001', text: 'A database', order: 2, isCorrect: false },
          ],
        },
      ],
      assignmentSettings: null,
    };

    const lessonWithAssignment = {
      ...baseLesson,
      id: 'lesson-003',
      title: 'Assignment Lesson',
      quizSettings: null,
      questions: [],
      assignmentSettings: {
        id: 'as-001',
        lessonId: 'lesson-003',
        gradingType: 'MANUAL' as const,
        maxScore: 100,
        passingScore: 60,
        dueDate: new Date('2025-12-31'),
        allowLateSubmission: false,
        isGroupAssignment: false,
        groupId: 'group-original',
        maxAttempts: 2,
      },
    };

    const mockSource: CourseForDuplicate = {
      ...mockCourse,
      status: 'PUBLISHED',
      modules: [
        {
          id: 'module-001',
          courseId: 'course-123',
          title: 'Module 1',
          description: 'Introduction',
          order: 1,
          isPublished: true,
          unlockAfterDays: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          lessons: [
            { ...baseLesson, quizSettings: null, questions: [], assignmentSettings: null },
            lessonWithQuiz,
            lessonWithAssignment,
          ],
        },
      ],
    };

    const mockDuplicated: Course = {
      ...mockCourse,
      id: 'course-999',
      title: 'Copia de TypeScript Basics',
      slug: 'copia-de-typescript-basics',
      status: 'DRAFT',
      instructorId: 'instructor-123',
    };

    beforeEach(() => {
      coursesRepository.findByIdForDuplicate.mockResolvedValue(mockSource);
      coursesRepository.findBySlug.mockResolvedValue(null); // slug is available
      coursesRepository.duplicateCourse.mockResolvedValue(mockDuplicated);
    });

    it('returns a new DRAFT course with prefixed title and unique slug', async () => {
      const result = await service.duplicate('course-123', 'instructor-123');

      expect(coursesRepository.findByIdForDuplicate).toHaveBeenCalledWith('course-123');
      expect(coursesRepository.duplicateCourse).toHaveBeenCalledWith(
        mockSource,
        expect.objectContaining({
          title: 'Copia de TypeScript Basics',
          slug: 'copia-de-typescript-basics',
          instructorId: 'instructor-123',
        }),
      );
      expect(result.status).toBe('DRAFT');
      expect(result.title).toBe('Copia de TypeScript Basics');
      expect(result.id).toBe('course-999');
    });

    it('throws NotFoundException when source course does not exist', async () => {
      coursesRepository.findByIdForDuplicate.mockResolvedValue(null);

      await expect(service.duplicate('nonexistent', 'instructor-123')).rejects.toThrow(
        NotFoundException,
      );
      expect(coursesRepository.duplicateCourse).not.toHaveBeenCalled();
    });

    it('appends -copy when base slug is already taken', async () => {
      coursesRepository.findBySlug
        .mockResolvedValueOnce(mockCourse) // base slug exists
        .mockResolvedValueOnce(null); // -copy is free

      await service.duplicate('course-123', 'instructor-123');

      expect(coursesRepository.duplicateCourse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'copia-de-typescript-basics-copy' }),
      );
    });

    it('appends -2 when base and -copy slugs are both taken', async () => {
      coursesRepository.findBySlug
        .mockResolvedValueOnce(mockCourse) // base slug exists
        .mockResolvedValueOnce(mockCourse) // -copy exists
        .mockResolvedValueOnce(null); // -2 is free

      await service.duplicate('course-123', 'instructor-123');

      expect(coursesRepository.duplicateCourse).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'copia-de-typescript-basics-2' }),
      );
    });

    it('passes the source with quiz settings through to duplicateCourse', async () => {
      await service.duplicate('course-123', 'instructor-123');

      const sourceArg = coursesRepository.duplicateCourse.mock.calls[0][0];
      const quizLesson = sourceArg.modules[0].lessons.find((l) => l.quizSettings !== null);
      expect(quizLesson).toBeDefined();
      expect(quizLesson?.quizSettings?.passingScore).toBe(70);
      expect(quizLesson?.questions).toHaveLength(1);
      expect(quizLesson?.questions[0].options).toHaveLength(2);
    });

    it('passes the source with assignment settings through to duplicateCourse', async () => {
      await service.duplicate('course-123', 'instructor-123');

      const sourceArg = coursesRepository.duplicateCourse.mock.calls[0][0];
      const assignmentLesson = sourceArg.modules[0].lessons.find(
        (l) => l.assignmentSettings !== null,
      );
      expect(assignmentLesson).toBeDefined();
      expect(assignmentLesson?.assignmentSettings?.maxScore).toBe(100);
      expect(assignmentLesson?.assignmentSettings?.gradingType).toBe('MANUAL');
    });
  });
});
