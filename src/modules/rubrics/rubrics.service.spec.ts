import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Rubric, RubricAssessmentAnswer, RubricCriterion, RubricLevel } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import type { CreateRubricAssessmentDto } from './dto/create-rubric-assessment.dto';
import type { CreateRubricDto } from './dto/create-rubric.dto';
import {
  type RubricAssessmentWithAnswers,
  type RubricWithCriteria,
  RubricsRepository,
} from './rubrics.repository';
import { RubricsService } from './rubrics.service';

const mockDate = new Date('2024-01-01');

const mockCourse: CourseDetailResponseDto = {
  id: 'course-123',
  title: 'TypeScript Basics',
  slug: 'typescript-basics',
  description: null,
  coverUrl: null,
  status: 'PUBLISHED',
  enrollmentType: 'FREE',
  price: null,
  instructorId: 'instructor-123',
  categoryId: null,
  enrollmentPeriodStart: null,
  enrollmentPeriodEnd: null,
  createdAt: mockDate,
  updatedAt: mockDate,
  lessonsCount: 5,
  enrollmentsCount: 10,
  level: 'BEGINNER',
  whatYouWillLearn: [],
  totalDuration: 0,
};

const mockRubric: Rubric = {
  id: 'rubric-123',
  courseId: 'course-123',
  title: 'Final Project Rubric',
  description: null,
  totalPoints: 100,
  isActive: true,
  createdAt: mockDate,
  updatedAt: mockDate,
};

const mockLevel: RubricLevel = {
  id: 'level-123',
  criterionId: 'criterion-123',
  title: 'Excellent',
  description: null,
  points: 20,
  order: 1,
  createdAt: mockDate,
  updatedAt: mockDate,
};

const mockCriterion: RubricCriterion & { levels: RubricLevel[] } = {
  id: 'criterion-123',
  rubricId: 'rubric-123',
  title: 'Code Quality',
  description: null,
  order: 1,
  points: 20,
  createdAt: mockDate,
  updatedAt: mockDate,
  levels: [mockLevel],
};

const mockRubricWithCriteria: RubricWithCriteria = {
  ...mockRubric,
  criteria: [mockCriterion],
};

const mockAnswer: RubricAssessmentAnswer = {
  id: 'answer-123',
  assessmentId: 'assessment-123',
  criterionId: 'criterion-123',
  levelId: 'level-123',
  pointsAwarded: 18,
  feedback: null,
  createdAt: mockDate,
};

const mockAssessment: RubricAssessmentWithAnswers = {
  id: 'assessment-123',
  rubricId: 'rubric-123',
  submissionId: 'submission-123',
  assessorId: 'instructor-123',
  totalScore: 18,
  feedback: null,
  assessedAt: mockDate,
  createdAt: mockDate,
  updatedAt: mockDate,
  answers: [mockAnswer],
};

const mockInstructor: AuthenticatedUser = {
  id: 'instructor-123',
  email: 'instructor@test.com',
  roles: ['INSTRUCTOR'],
};

const mockAdmin: AuthenticatedUser = {
  id: 'admin-123',
  email: 'admin@test.com',
  roles: ['ADMIN'],
};

const mockOtherInstructor: AuthenticatedUser = {
  id: 'other-instructor-456',
  email: 'other@test.com',
  roles: ['INSTRUCTOR'],
};

describe('RubricsService', () => {
  let service: RubricsService;
  let rubricsRepository: jest.Mocked<
    Pick<
      RubricsRepository,
      | 'findByCourseId'
      | 'findById'
      | 'findByIdWithCriteria'
      | 'hasAssessments'
      | 'create'
      | 'update'
      | 'delete'
      | 'findAssessmentBySubmissionId'
      | 'createAssessment'
      | 'findSubmissionById'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;

  beforeEach(async () => {
    rubricsRepository = {
      findByCourseId: jest.fn(),
      findById: jest.fn(),
      findByIdWithCriteria: jest.fn(),
      hasAssessments: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAssessmentBySubmissionId: jest.fn(),
      createAssessment: jest.fn(),
      findSubmissionById: jest.fn(),
    };

    coursesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RubricsService,
        { provide: RubricsRepository, useValue: rubricsRepository },
        { provide: CoursesService, useValue: coursesService },
      ],
    }).compile();

    service = module.get<RubricsService>(RubricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns mapped summaries for a course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByCourseId.mockResolvedValue([mockRubric]);

      const result = await service.findAll('course-123', mockInstructor);

      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', mockInstructor);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rubric-123');
      expect(result[0]).not.toHaveProperty('criteria');
    });

    it('propagates NotFoundException from coursesService when course not found', async () => {
      coursesService.findOne.mockRejectedValue(new NotFoundException('Course not found'));

      await expect(service.findAll('bad-course', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns rubric with criteria when it belongs to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);

      const result = await service.findOne('course-123', 'rubric-123', mockInstructor);

      expect(result.id).toBe('rubric-123');
      expect(result.criteria).toHaveLength(1);
      expect(result.criteria[0].levels).toHaveLength(1);
    });

    it('throws NotFoundException when rubric does not exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(null);

      await expect(service.findOne('course-123', 'missing-rubric', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when rubric belongs to a different course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue({
        ...mockRubricWithCriteria,
        courseId: 'other-course-999',
      });

      await expect(service.findOne('course-123', 'rubric-123', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateRubricDto = {
      title: 'Final Project Rubric',
      totalPoints: 100,
      criteria: [
        {
          title: 'Code Quality',
          order: 1,
          points: 20,
          levels: [{ title: 'Excellent', points: 20, order: 1 }],
        },
      ],
    };

    it('creates rubric when caller is the course owner', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.create.mockResolvedValue(mockRubricWithCriteria);

      const result = await service.create('course-123', createDto, mockInstructor);

      expect(rubricsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'course-123', title: 'Final Project Rubric' }),
      );
      expect(result.id).toBe('rubric-123');
    });

    it('creates rubric when caller is an admin (not the owner)', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.create.mockResolvedValue(mockRubricWithCriteria);

      const result = await service.create('course-123', createDto, mockAdmin);

      expect(result.id).toBe('rubric-123');
    });

    it('throws ForbiddenException when non-owner instructor tries to create', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);

      await expect(service.create('course-123', createDto, mockOtherInstructor)).rejects.toThrow(
        ForbiddenException,
      );
      expect(rubricsRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates rubric and re-fetches with criteria', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      rubricsRepository.update.mockResolvedValue({ ...mockRubric, title: 'Updated Title' });
      rubricsRepository.findByIdWithCriteria.mockResolvedValue({
        ...mockRubricWithCriteria,
        title: 'Updated Title',
      });

      const result = await service.update(
        'course-123',
        'rubric-123',
        { title: 'Updated Title' },
        mockInstructor,
      );

      expect(rubricsRepository.update).toHaveBeenCalledWith(
        'rubric-123',
        expect.objectContaining({ title: 'Updated Title' }),
      );
      expect(result.title).toBe('Updated Title');
      expect(result.criteria).toHaveLength(1);
    });

    it('throws ForbiddenException when non-owner instructor tries to update', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);

      await expect(
        service.update('course-123', 'rubric-123', { title: 'Hack' }, mockOtherInstructor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when rubric does not belong to course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findById.mockResolvedValue({ ...mockRubric, courseId: 'other-course' });

      await expect(
        service.update('course-123', 'rubric-123', { title: 'New' }, mockInstructor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes rubric successfully when no assessments exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      rubricsRepository.hasAssessments.mockResolvedValue(false);
      rubricsRepository.delete.mockResolvedValue(mockRubric);

      await service.delete('course-123', 'rubric-123', mockInstructor);

      expect(rubricsRepository.delete).toHaveBeenCalledWith('rubric-123');
    });

    it('throws ConflictException when assessments exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      rubricsRepository.hasAssessments.mockResolvedValue(true);

      await expect(service.delete('course-123', 'rubric-123', mockInstructor)).rejects.toThrow(
        ConflictException,
      );
      expect(rubricsRepository.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when non-owner instructor tries to delete', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);

      await expect(service.delete('course-123', 'rubric-123', mockOtherInstructor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when rubric does not exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findById.mockResolvedValue(null);

      await expect(service.delete('course-123', 'rubric-123', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── createAssessment ─────────────────────────────────────────────────────────

  describe('createAssessment', () => {
    const assessmentDto: CreateRubricAssessmentDto = {
      answers: [{ criterionId: 'criterion-123', levelId: 'level-123', pointsAwarded: 18 }],
    };

    it('calculates totalScore as sum of all answers pointsAwarded', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'course-123', userId: 'student-123' },
      });
      rubricsRepository.createAssessment.mockResolvedValue({
        ...mockAssessment,
        totalScore: 18,
        answers: [{ ...mockAnswer, pointsAwarded: 18 }],
      });

      const result = await service.createAssessment(
        'course-123',
        'rubric-123',
        'submission-123',
        assessmentDto,
        mockInstructor,
      );

      expect(rubricsRepository.createAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ totalScore: 18 }),
      );
      expect(result.score).toBe(18);
    });

    it('throws ForbiddenException when non-owner instructor tries to create assessment', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          assessmentDto,
          mockOtherInstructor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(rubricsRepository.createAssessment).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a criterionId does not belong to the rubric', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'course-123', userId: 'student-123' },
      });

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          { answers: [{ criterionId: 'criterion-BOGUS', pointsAwarded: 10 }] },
          mockInstructor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(rubricsRepository.createAssessment).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when rubric does not belong to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue({
        ...mockRubricWithCriteria,
        courseId: 'other-course',
      });

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          assessmentDto,
          mockInstructor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when rubric is not found', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(null);

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          assessmentDto,
          mockInstructor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when submission does not belong to the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'different-course-999', userId: 'student-123' },
      });

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          assessmentDto,
          mockInstructor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when submission is not found', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);
      rubricsRepository.findSubmissionById.mockResolvedValue(null);

      await expect(
        service.createAssessment(
          'course-123',
          'rubric-123',
          'submission-123',
          assessmentDto,
          mockInstructor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets assessorId to the authenticated user id', async () => {
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findByIdWithCriteria.mockResolvedValue(mockRubricWithCriteria);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'course-123', userId: 'student-123' },
      });
      rubricsRepository.createAssessment.mockResolvedValue(mockAssessment);

      await service.createAssessment(
        'course-123',
        'rubric-123',
        'submission-123',
        assessmentDto,
        mockInstructor,
      );

      expect(rubricsRepository.createAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ assessorId: 'instructor-123' }),
      );
    });
  });

  // ─── getAssessment ────────────────────────────────────────────────────────────

  describe('getAssessment', () => {
    const mockStudent: AuthenticatedUser = {
      id: 'student-123',
      email: 'student@test.com',
      roles: ['STUDENT'],
    };

    it('returns assessment when called by the course instructor (owner)', async () => {
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findAssessmentBySubmissionId.mockResolvedValue(mockAssessment);

      const result = await service.getAssessment(
        'course-123',
        'rubric-123',
        'submission-123',
        mockInstructor,
      );

      expect(result.id).toBe('assessment-123');
      expect(result.score).toBe(18);
      expect(result.answers).toHaveLength(1);
    });

    it('returns assessment when called by the student who owns the submission', async () => {
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'course-123', userId: 'student-123' },
      });
      rubricsRepository.findAssessmentBySubmissionId.mockResolvedValue(mockAssessment);

      const result = await service.getAssessment(
        'course-123',
        'rubric-123',
        'submission-123',
        mockStudent,
      );

      expect(result.id).toBe('assessment-123');
    });

    it('throws ForbiddenException when non-owner instructor tries to view assessment', async () => {
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);

      await expect(
        service.getAssessment('course-123', 'rubric-123', 'submission-123', mockOtherInstructor),
      ).rejects.toThrow(ForbiddenException);
      expect(rubricsRepository.findAssessmentBySubmissionId).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException when student tries to view another student's assessment", async () => {
      const otherStudent: AuthenticatedUser = {
        id: 'other-student-999',
        email: 'other@test.com',
        roles: ['STUDENT'],
      };
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findSubmissionById.mockResolvedValue({
        id: 'submission-123',
        enrollmentId: 'enrollment-123',
        enrollment: { courseId: 'course-123', userId: 'student-123' },
      });

      await expect(
        service.getAssessment('course-123', 'rubric-123', 'submission-123', otherStudent),
      ).rejects.toThrow(ForbiddenException);
      expect(rubricsRepository.findAssessmentBySubmissionId).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when assessment is not found', async () => {
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findAssessmentBySubmissionId.mockResolvedValue(null);

      await expect(
        service.getAssessment('course-123', 'rubric-123', 'submission-123', mockInstructor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when assessment belongs to a different rubric', async () => {
      rubricsRepository.findById.mockResolvedValue(mockRubric);
      coursesService.findOne.mockResolvedValue(mockCourse);
      rubricsRepository.findAssessmentBySubmissionId.mockResolvedValue({
        ...mockAssessment,
        rubricId: 'different-rubric-999',
      });

      await expect(
        service.getAssessment('course-123', 'rubric-123', 'submission-123', mockInstructor),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when rubric does not belong to course', async () => {
      rubricsRepository.findById.mockResolvedValue({ ...mockRubric, courseId: 'other-course' });

      await expect(
        service.getAssessment('course-123', 'rubric-123', 'submission-123', mockInstructor),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
