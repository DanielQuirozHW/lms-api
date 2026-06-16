import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { GradebookCategory, GradebookItem } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import type { CategoryWithItems } from './gradebook.repository';
import { GradebookRepository } from './gradebook.repository';
import { GradebookService } from './gradebook.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INSTRUCTOR_ID = 'instructor-uuid';
const STUDENT_ID = 'student-uuid';
const OTHER_STUDENT_ID = 'other-student-uuid';
const COURSE_ID = 'course-uuid';
const CATEGORY_ID = 'category-uuid';
const ITEM_ID = 'item-uuid';
const LESSON_ID = 'lesson-uuid';
const ENROLLMENT_ID = 'enrollment-uuid';

const mockInstructor: AuthenticatedUser = {
  id: INSTRUCTOR_ID,
  email: 'instructor@test.com',
  roles: ['INSTRUCTOR'],
};

const mockStudent: AuthenticatedUser = {
  id: STUDENT_ID,
  email: 'student@test.com',
  roles: ['STUDENT'],
};

const mockOtherStudent: AuthenticatedUser = {
  id: OTHER_STUDENT_ID,
  email: 'other@test.com',
  roles: ['STUDENT'],
};

const mockAdmin: AuthenticatedUser = {
  id: 'admin-uuid',
  email: 'admin@test.com',
  roles: ['ADMIN'],
};

const mockCourseDetail: CourseDetailResponseDto = {
  id: COURSE_ID,
  title: 'Test Course',
  slug: 'test-course',
  description: null,
  coverUrl: null,
  status: 'PUBLISHED',
  enrollmentType: 'FREE',
  price: null,
  instructorId: INSTRUCTOR_ID,
  categoryId: null,
  enrollmentPeriodStart: null,
  enrollmentPeriodEnd: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lessonsCount: 3,
  enrollmentsCount: 10,
};

const mockCategory: GradebookCategory = {
  id: CATEGORY_ID,
  courseId: COURSE_ID,
  name: 'Quizzes',
  weight: 40,
  order: 1,
  isActive: true,
};

const mockItem: GradebookItem = {
  id: ITEM_ID,
  categoryId: CATEGORY_ID,
  lessonId: LESSON_ID,
  weight: null,
  maxScore: 100,
  isExtraCredit: false,
  isActive: true,
};

const mockCategoryWithItems: CategoryWithItems = {
  ...mockCategory,
  items: [mockItem],
};

const mockCategoryWithCount = {
  ...mockCategory,
  _count: { items: 1 },
};

const mockEmptyCategoryWithCount = {
  ...mockCategory,
  _count: { items: 0 },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GradebookService', () => {
  let service: GradebookService;
  let gradebookRepository: jest.Mocked<
    Pick<
      GradebookRepository,
      | 'findCategoriesWithItems'
      | 'findCategoryById'
      | 'findCategoryByIdAndCourse'
      | 'findItemById'
      | 'findItemByCategoryAndCourse'
      | 'findLessonInCourse'
      | 'createCategory'
      | 'updateCategory'
      | 'deleteCategory'
      | 'createItem'
      | 'deleteItem'
      | 'findEnrollmentById'
      | 'getQuizScores'
      | 'getSubmissionScores'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;

  beforeEach(async () => {
    gradebookRepository = {
      findCategoriesWithItems: jest.fn(),
      findCategoryById: jest.fn(),
      findCategoryByIdAndCourse: jest.fn(),
      findItemById: jest.fn(),
      findItemByCategoryAndCourse: jest.fn(),
      findLessonInCourse: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      createItem: jest.fn(),
      deleteItem: jest.fn(),
      findEnrollmentById: jest.fn(),
      getQuizScores: jest.fn(),
      getSubmissionScores: jest.fn(),
    };

    coursesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradebookService,
        { provide: GradebookRepository, useValue: gradebookRepository },
        { provide: CoursesService, useValue: coursesService },
      ],
    }).compile();

    service = module.get<GradebookService>(GradebookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findStructure ──────────────────────────────────────────────────────────

  describe('findStructure', () => {
    it('returns gradebook structure with categories and totalWeight', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([mockCategoryWithItems]);

      const result = await service.findStructure(COURSE_ID, mockInstructor);

      expect(result.courseId).toBe(COURSE_ID);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].name).toBe('Quizzes');
      expect(result.categories[0].items).toHaveLength(1);
      expect(result.totalWeight).toBe(40);
    });

    it('returns zero totalWeight when no categories exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([]);

      const result = await service.findStructure(COURSE_ID, mockInstructor);

      expect(result.categories).toHaveLength(0);
      expect(result.totalWeight).toBe(0);
    });

    it('throws NotFoundException when course does not exist', async () => {
      coursesService.findOne.mockRejectedValue(new NotFoundException('Course not found'));

      await expect(service.findStructure('bad-id', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── createCategory ─────────────────────────────────────────────────────────

  describe('createCategory', () => {
    it('creates a category and returns the response DTO', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.createCategory.mockResolvedValue(mockCategory);

      const result = await service.createCategory(
        COURSE_ID,
        { name: 'Quizzes', weight: 40, order: 1 },
        mockInstructor,
      );

      expect(result.name).toBe('Quizzes');
      expect(result.courseId).toBe(COURSE_ID);
      expect(gradebookRepository.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Quizzes',
          weight: 40,
          order: 1,
          course: { connect: { id: COURSE_ID } },
        }),
      );
    });

    it('throws ForbiddenException when a non-owner instructor tries to create', async () => {
      const otherInstructor: AuthenticatedUser = {
        id: 'other-instructor',
        email: 'other@test.com',
        roles: ['INSTRUCTOR'],
      };
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(
        service.createCategory(
          COURSE_ID,
          { name: 'Quizzes', weight: 40, order: 1 },
          otherInstructor,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(gradebookRepository.createCategory).not.toHaveBeenCalled();
    });

    it('allows admin to create a category they do not own', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.createCategory.mockResolvedValue(mockCategory);

      await expect(
        service.createCategory(COURSE_ID, { name: 'Quizzes', weight: 40, order: 1 }, mockAdmin),
      ).resolves.toBeDefined();
    });
  });

  // ─── deleteCategory ─────────────────────────────────────────────────────────

  describe('deleteCategory', () => {
    it('throws ConflictException when the category still has items', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(mockCategoryWithCount);

      await expect(service.deleteCategory(COURSE_ID, CATEGORY_ID, mockInstructor)).rejects.toThrow(
        ConflictException,
      );

      expect(gradebookRepository.deleteCategory).not.toHaveBeenCalled();
    });

    it('deletes category successfully when it has no items', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(mockEmptyCategoryWithCount);
      gradebookRepository.deleteCategory.mockResolvedValue(mockCategory);

      await expect(
        service.deleteCategory(COURSE_ID, CATEGORY_ID, mockInstructor),
      ).resolves.toBeUndefined();

      expect(gradebookRepository.deleteCategory).toHaveBeenCalledWith(CATEGORY_ID);
    });

    it('throws NotFoundException when category does not belong to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(null);

      await expect(service.deleteCategory(COURSE_ID, 'wrong-id', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(
        service.deleteCategory(COURSE_ID, CATEGORY_ID, mockOtherStudent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getStudentGrade ────────────────────────────────────────────────────────

  describe('getStudentGrade', () => {
    const mockEnrollment = { id: ENROLLMENT_ID, courseId: COURSE_ID, userId: STUDENT_ID };

    it('throws NotFoundException when enrollment does not exist', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(null);

      await expect(service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockStudent)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when enrollment belongs to a different course', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue({
        ...mockEnrollment,
        courseId: 'different-course',
      });

      await expect(service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockStudent)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when a student tries to view another student grade', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      // C-1: non-own, non-admin access now goes through coursesService.findOne
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(
        service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockOtherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns grade for the enrolled student viewing their own grade', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([mockCategoryWithItems]);
      gradebookRepository.getQuizScores.mockResolvedValue(new Map([[LESSON_ID, 80]]));
      gradebookRepository.getSubmissionScores.mockResolvedValue(new Map());

      const result = await service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockStudent);

      expect(result.enrollmentId).toBe(ENROLLMENT_ID);
      expect(result.courseId).toBe(COURSE_ID);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].items[0].rawScore).toBe(80);
      expect(result.categories[0].items[0].percentageScore).toBe(80);
    });

    it('allows instructor to view any student grade when they own the course', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([]);
      gradebookRepository.getQuizScores.mockResolvedValue(new Map());
      gradebookRepository.getSubmissionScores.mockResolvedValue(new Map());

      await expect(
        service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockInstructor),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when instructor does not own the course', async () => {
      const otherInstructor: AuthenticatedUser = {
        id: 'other-instructor',
        email: 'other@test.com',
        roles: ['INSTRUCTOR'],
      };
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(
        service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, otherInstructor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to view any student grade', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([]);
      gradebookRepository.getQuizScores.mockResolvedValue(new Map());
      gradebookRepository.getSubmissionScores.mockResolvedValue(new Map());

      await expect(
        service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockAdmin),
      ).resolves.toBeDefined();
    });

    it('correctly calculates weighted final grade from quiz and submission scores', async () => {
      // Category: weight=40, one quiz item (maxScore=100), one assignment item (maxScore=50)
      const quizItem: GradebookItem = {
        id: 'item-quiz',
        categoryId: CATEGORY_ID,
        lessonId: 'lesson-quiz',
        weight: null,
        maxScore: 100,
        isExtraCredit: false,
        isActive: true,
      };
      const assignmentItem: GradebookItem = {
        id: 'item-assign',
        categoryId: CATEGORY_ID,
        lessonId: 'lesson-assign',
        weight: null,
        maxScore: 50,
        isExtraCredit: false,
        isActive: true,
      };
      const categoryWithTwoItems: CategoryWithItems = {
        ...mockCategory,
        weight: 100,
        items: [quizItem, assignmentItem],
      };

      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([categoryWithTwoItems]);
      // quiz: 80/100 = 80%, assignment: 40/50 = 80%
      gradebookRepository.getQuizScores.mockResolvedValue(new Map([['lesson-quiz', 80]]));
      gradebookRepository.getSubmissionScores.mockResolvedValue(new Map([['lesson-assign', 40]]));

      const result = await service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockStudent);

      // categoryScore = (80 + 80) / 2 = 80, finalGrade = 80 * (100/100) = 80
      expect(result.finalGrade).toBeCloseTo(80);
    });

    it('returns null finalGrade when no scores exist', async () => {
      gradebookRepository.findEnrollmentById.mockResolvedValue(mockEnrollment);
      gradebookRepository.findCategoriesWithItems.mockResolvedValue([mockCategoryWithItems]);
      gradebookRepository.getQuizScores.mockResolvedValue(new Map());
      gradebookRepository.getSubmissionScores.mockResolvedValue(new Map());

      const result = await service.getStudentGrade(COURSE_ID, ENROLLMENT_ID, mockStudent);

      expect(result.finalGrade).toBeNull();
      expect(result.categories[0].categoryScore).toBeNull();
    });
  });

  // ─── createItem ─────────────────────────────────────────────────────────────

  describe('createItem', () => {
    const createItemDto = { categoryId: CATEGORY_ID, lessonId: LESSON_ID, maxScore: 100 };

    it('creates item when lesson belongs to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(mockEmptyCategoryWithCount);
      gradebookRepository.findLessonInCourse.mockResolvedValue({ id: LESSON_ID });
      gradebookRepository.createItem.mockResolvedValue(mockItem);

      const result = await service.createItem(COURSE_ID, createItemDto, mockInstructor);

      expect(gradebookRepository.findLessonInCourse).toHaveBeenCalledWith(LESSON_ID, COURSE_ID);
      expect(gradebookRepository.createItem).toHaveBeenCalled();
      expect(result.lessonId).toBe(LESSON_ID);
    });

    it('throws NotFoundException when lesson does not belong to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(mockEmptyCategoryWithCount);
      gradebookRepository.findLessonInCourse.mockResolvedValue(null);

      await expect(service.createItem(COURSE_ID, createItemDto, mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
      expect(gradebookRepository.createItem).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when category does not belong to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      gradebookRepository.findCategoryByIdAndCourse.mockResolvedValue(null);

      await expect(service.createItem(COURSE_ID, createItemDto, mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
      expect(gradebookRepository.createItem).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when non-owner instructor tries to create item', async () => {
      const otherInstructor: AuthenticatedUser = {
        id: 'other-instructor',
        email: 'other@test.com',
        roles: ['INSTRUCTOR'],
      };
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(service.createItem(COURSE_ID, createItemDto, otherInstructor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(gradebookRepository.createItem).not.toHaveBeenCalled();
    });
  });
});
