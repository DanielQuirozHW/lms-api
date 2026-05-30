import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { LessonType, NotificationType, QuestionType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { SubmitAnswersDto } from './dto/submit-answers.dto';
import {
  type AttemptWithAnswers,
  type LessonWithContext,
  type QuestionWithOptions,
  QuizRepository,
} from './quiz.repository';
import { QuizService } from './quiz.service';
import type { QuestionOption, QuizAttempt, QuizSettings } from '@prisma/client';

const now = new Date('2026-06-01T10:00:00.000Z');

const mockSettings: QuizSettings = {
  id: 'settings-123',
  lessonId: 'lesson-123',
  maxAttempts: 3,
  passingScore: 70,
  blocksProgress: true,
  shuffleQuestions: false,
};

const mockLesson: LessonWithContext = {
  id: 'lesson-123',
  moduleId: 'module-123',
  title: 'JS Quiz',
  order: 2,
  type: LessonType.QUIZ,
  content: null,
  videoUrl: null,
  duration: null,
  isPreview: false,
  isPublished: true,
  rubricId: null,
  createdAt: now,
  updatedAt: now,
  module: {
    id: 'module-123',
    courseId: 'course-123',
    course: { instructorId: 'instructor-123' },
  },
  quizSettings: mockSettings,
};

const mockOption = (id: string, isCorrect: boolean, order = 1): QuestionOption => ({
  id,
  questionId: 'q-123',
  text: 'Option text',
  isCorrect,
  order,
});

const mockQuestion: QuestionWithOptions = {
  id: 'q-123',
  lessonId: 'lesson-123',
  text: 'What is 2+2?',
  type: QuestionType.SINGLE_CHOICE,
  order: 1,
  points: 10,
  options: [mockOption('opt-correct', true, 1), mockOption('opt-wrong', false, 2)],
};

const mockAttempt: QuizAttempt = {
  id: 'attempt-123',
  enrollmentId: 'enrollment-123',
  lessonId: 'lesson-123',
  score: null,
  attemptNumber: 1,
  startedAt: now,
  completedAt: null,
};

const mockAttemptWithAnswers: AttemptWithAnswers = {
  ...mockAttempt,
  enrollment: { userId: 'student-123' },
  answers: [
    {
      id: 'answer-123',
      attemptId: 'attempt-123',
      questionId: 'q-123',
      selectedOptionId: 'opt-correct',
      textAnswer: null,
      question: { type: QuestionType.SINGLE_CHOICE, points: 10 },
      selectedOption: { isCorrect: true },
    },
  ],
};

const studentUser: AuthenticatedUser = {
  id: 'student-123',
  email: 'student@test.com',
  roles: [UserRole.STUDENT],
};

const instructorUser: AuthenticatedUser = {
  id: 'instructor-123',
  email: 'instructor@test.com',
  roles: [UserRole.INSTRUCTOR],
};

const adminUser: AuthenticatedUser = {
  id: 'admin-123',
  email: 'admin@test.com',
  roles: [UserRole.ADMIN],
};

const otherStudentUser: AuthenticatedUser = {
  id: 'other-456',
  email: 'other@test.com',
  roles: [UserRole.STUDENT],
};

describe('QuizService', () => {
  let service: QuizService;
  let quizRepository: jest.Mocked<
    Pick<
      QuizRepository,
      | 'findLessonWithContext'
      | 'findQuestionsByLessonId'
      | 'findQuestionById'
      | 'addQuestion'
      | 'updateQuestion'
      | 'deleteQuestion'
      | 'findMaxQuestionOrder'
      | 'upsertSettings'
      | 'findActiveEnrollment'
      | 'countCompletedAttempts'
      | 'findIncompleteAttempt'
      | 'findMaxAttemptNumber'
      | 'createAttempt'
      | 'findAttemptsByEnrollment'
      | 'findAttemptById'
      | 'completeAttempt'
      | 'completeLessonProgress'
      | 'unlockNextLesson'
      | 'findAllAttemptsByLesson'
      | 'hasCompletedAttempt'
      | 'transaction'
    >
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'notify'>>;

  beforeEach(async () => {
    quizRepository = {
      findLessonWithContext: jest.fn(),
      findQuestionsByLessonId: jest.fn(),
      findQuestionById: jest.fn(),
      addQuestion: jest.fn(),
      updateQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
      findMaxQuestionOrder: jest.fn(),
      upsertSettings: jest.fn(),
      findActiveEnrollment: jest.fn(),
      countCompletedAttempts: jest.fn(),
      findIncompleteAttempt: jest.fn(),
      findMaxAttemptNumber: jest.fn(),
      createAttempt: jest.fn(),
      findAttemptsByEnrollment: jest.fn(),
      findAttemptById: jest.fn(),
      completeAttempt: jest.fn(),
      completeLessonProgress: jest.fn(),
      unlockNextLesson: jest.fn(),
      findAllAttemptsByLesson: jest.fn(),
      hasCompletedAttempt: jest.fn(),
      transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    notificationsService = {
      notify: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: QuizRepository, useValue: quizRepository },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(QuizService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getLessonOrFail guards ───────────────────────────────────────────────────

  describe('lesson type guard', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(null);

      await expect(service.getSettings('lesson-999', studentUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when lesson type is not QUIZ', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue({
        ...mockLesson,
        type: LessonType.TEXT,
      });

      await expect(service.getSettings('lesson-123', instructorUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── startAttempt ─────────────────────────────────────────────────────────────

  describe('startAttempt', () => {
    it('creates attempt with attemptNumber 1 on first start', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.countCompletedAttempts.mockResolvedValue(0);
      quizRepository.findIncompleteAttempt.mockResolvedValue(null);
      quizRepository.findMaxAttemptNumber.mockResolvedValue(0);
      quizRepository.createAttempt.mockResolvedValue(mockAttempt);

      const result = await service.startAttempt('lesson-123', studentUser);

      expect(quizRepository.createAttempt).toHaveBeenCalledWith('enrollment-123', 'lesson-123', 1);
      expect(result.attemptNumber).toBe(1);
      expect(result.completedAt).toBeNull();
    });

    it('throws ForbiddenException when student is not enrolled', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue(null);

      await expect(service.startAttempt('lesson-123', studentUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(quizRepository.createAttempt).not.toHaveBeenCalled();
    });

    it('throws ConflictException when maxAttempts is reached', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson); // maxAttempts: 3
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.countCompletedAttempts.mockResolvedValue(3);

      await expect(service.startAttempt('lesson-123', studentUser)).rejects.toThrow(
        ConflictException,
      );
      expect(quizRepository.createAttempt).not.toHaveBeenCalled();
    });

    it('throws ConflictException when there is an incomplete attempt', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.countCompletedAttempts.mockResolvedValue(1);
      quizRepository.findIncompleteAttempt.mockResolvedValue(mockAttempt);

      await expect(service.startAttempt('lesson-123', studentUser)).rejects.toThrow(
        ConflictException,
      );
      expect(quizRepository.createAttempt).not.toHaveBeenCalled();
    });

    it('allows start when no maxAttempts is set on settings', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue({
        ...mockLesson,
        quizSettings: { ...mockSettings, maxAttempts: null },
      });
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.findIncompleteAttempt.mockResolvedValue(null);
      quizRepository.findMaxAttemptNumber.mockResolvedValue(0);
      quizRepository.createAttempt.mockResolvedValue(mockAttempt);

      const result = await service.startAttempt('lesson-123', studentUser);

      expect(quizRepository.countCompletedAttempts).not.toHaveBeenCalled();
      expect(result.id).toBe('attempt-123');
    });
  });

  // ─── submitAttempt ────────────────────────────────────────────────────────────

  describe('submitAttempt', () => {
    const dto: SubmitAnswersDto = {
      answers: [{ questionId: 'q-123', selectedOptionId: 'opt-correct' }],
    };

    beforeEach(() => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findAttemptById.mockResolvedValue(mockAttemptWithAnswers);
      quizRepository.findQuestionsByLessonId.mockResolvedValue([mockQuestion]);
      quizRepository.completeAttempt.mockResolvedValue({
        ...mockAttempt,
        score: 100,
        completedAt: now,
      });
      quizRepository.completeLessonProgress.mockResolvedValue(undefined);
      quizRepository.unlockNextLesson.mockResolvedValue(undefined);
    });

    it('calculates 100% score when all auto-graded answers are correct', async () => {
      quizRepository.findAttemptById
        .mockResolvedValueOnce(mockAttemptWithAnswers) // first call (submission check)
        .mockResolvedValueOnce({ ...mockAttemptWithAnswers, score: 100, completedAt: now }); // final fetch

      const result = await service.submitAttempt('lesson-123', 'attempt-123', dto, studentUser);

      expect(quizRepository.completeAttempt).toHaveBeenCalledWith(
        'attempt-123',
        dto.answers,
        100,
        expect.any(Date),
        expect.anything(),
      );
      expect(result.score).toBe(100);
    });

    it('throws ConflictException when attempt is already submitted', async () => {
      quizRepository.findAttemptById.mockResolvedValue({
        ...mockAttemptWithAnswers,
        completedAt: now,
      });

      await expect(
        service.submitAttempt('lesson-123', 'attempt-123', dto, studentUser),
      ).rejects.toThrow(ConflictException);
      expect(quizRepository.completeAttempt).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when attempt belongs to a different user', async () => {
      await expect(
        service.submitAttempt('lesson-123', 'attempt-123', dto, otherStudentUser),
      ).rejects.toThrow(ForbiddenException);
      expect(quizRepository.completeAttempt).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when attemptId is for a different lesson (BOLA)', async () => {
      quizRepository.findAttemptById.mockResolvedValue({
        ...mockAttemptWithAnswers,
        lessonId: 'other-lesson-999',
      });

      await expect(
        service.submitAttempt('lesson-123', 'attempt-123', dto, studentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when an answer references a questionId not in this quiz', async () => {
      await expect(
        service.submitAttempt(
          'lesson-123',
          'attempt-123',
          { answers: [{ questionId: 'q-BOGUS', selectedOptionId: 'opt-correct' }] },
          studentUser,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(quizRepository.completeAttempt).not.toHaveBeenCalled();
    });

    it('completes progress and unlocks next lesson when score passes and blocksProgress is true', async () => {
      quizRepository.findAttemptById
        .mockResolvedValueOnce(mockAttemptWithAnswers)
        .mockResolvedValueOnce({ ...mockAttemptWithAnswers, score: 100, completedAt: now });

      await service.submitAttempt('lesson-123', 'attempt-123', dto, studentUser);

      // score=100 >= passingScore=70 → passed
      expect(quizRepository.completeLessonProgress).toHaveBeenCalledWith(
        'enrollment-123',
        'lesson-123',
        expect.anything(),
      );
      expect(quizRepository.unlockNextLesson).toHaveBeenCalledWith(
        'enrollment-123',
        'module-123',
        2, // lesson.order
        expect.anything(),
      );
    });

    it('sends QUIZ_PASSED notification when student passes', async () => {
      quizRepository.findAttemptById
        .mockResolvedValueOnce(mockAttemptWithAnswers)
        .mockResolvedValueOnce({ ...mockAttemptWithAnswers, score: 100, completedAt: now });

      await service.submitAttempt('lesson-123', 'attempt-123', dto, studentUser);

      // allow void promise to settle
      await Promise.resolve();
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'student-123',
        NotificationType.QUIZ_PASSED,
        expect.any(String),
        expect.any(String),
        'lesson-123',
        'lesson',
      );
    });

    it('sends QUIZ_FAILED and does not unlock progress when score is below passing', async () => {
      const failingAttempt: AttemptWithAnswers = {
        ...mockAttemptWithAnswers,
        answers: [
          {
            id: 'answer-123',
            attemptId: 'attempt-123',
            questionId: 'q-123',
            selectedOptionId: 'opt-wrong',
            textAnswer: null,
            question: { type: QuestionType.SINGLE_CHOICE, points: 10 },
            selectedOption: { isCorrect: false },
          },
        ],
      };
      quizRepository.findAttemptById
        .mockResolvedValueOnce(failingAttempt)
        .mockResolvedValueOnce({ ...failingAttempt, score: 0, completedAt: now });
      quizRepository.completeAttempt.mockResolvedValue({
        ...mockAttempt,
        score: 0,
        completedAt: now,
      });

      await service.submitAttempt(
        'lesson-123',
        'attempt-123',
        { answers: [{ questionId: 'q-123', selectedOptionId: 'opt-wrong' }] },
        studentUser,
      );

      await Promise.resolve();
      expect(quizRepository.completeLessonProgress).not.toHaveBeenCalled();
      expect(quizRepository.unlockNextLesson).not.toHaveBeenCalled();
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'student-123',
        NotificationType.QUIZ_FAILED,
        expect.any(String),
        expect.any(String),
        'lesson-123',
        'lesson',
      );
    });
  });

  // ─── listQuestions ────────────────────────────────────────────────────────────

  describe('listQuestions', () => {
    it('instructor always sees isCorrect on options', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findQuestionsByLessonId.mockResolvedValue([mockQuestion]);

      const result = await service.listQuestions('lesson-123', instructorUser);

      expect(result[0].options[0].isCorrect).toBe(true);
      expect(result[0].options[1].isCorrect).toBe(false);
    });

    it('admin always sees isCorrect on options', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findQuestionsByLessonId.mockResolvedValue([mockQuestion]);

      const result = await service.listQuestions('lesson-123', adminUser);

      expect(result[0].options[0].isCorrect).toBe(true);
    });

    it('student with no completed attempt does not see isCorrect', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.hasCompletedAttempt.mockResolvedValue(false);
      quizRepository.findQuestionsByLessonId.mockResolvedValue([mockQuestion]);

      const result = await service.listQuestions('lesson-123', studentUser);

      expect(result[0].options[0].isCorrect).toBeUndefined();
    });

    it('student with completed attempt sees isCorrect', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      quizRepository.hasCompletedAttempt.mockResolvedValue(true);
      quizRepository.findQuestionsByLessonId.mockResolvedValue([mockQuestion]);

      const result = await service.listQuestions('lesson-123', studentUser);

      expect(result[0].options[0].isCorrect).toBe(true);
    });

    it('throws ForbiddenException when student is not enrolled', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findActiveEnrollment.mockResolvedValue(null);

      await expect(service.listQuestions('lesson-123', studentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── deleteQuestion ───────────────────────────────────────────────────────────

  describe('deleteQuestion', () => {
    it('throws NotFoundException when question does not belong to lesson', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findQuestionById.mockResolvedValue(null);

      await expect(service.deleteQuestion('lesson-123', 'q-999', instructorUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(quizRepository.deleteQuestion).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when instructor does not own the course', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);

      await expect(
        service.deleteQuestion('lesson-123', 'q-123', {
          ...instructorUser,
          id: 'other-instructor-456',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getAttempt ───────────────────────────────────────────────────────────────

  describe('getAttempt', () => {
    it('student can view their own completed attempt with isCorrect', async () => {
      const completedAttempt: AttemptWithAnswers = {
        ...mockAttemptWithAnswers,
        completedAt: now,
        score: 100,
      };
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findAttemptById.mockResolvedValue(completedAttempt);

      const result = await service.getAttempt('lesson-123', 'attempt-123', studentUser);

      expect(result.answers[0].isCorrect).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('student cannot view another student attempt', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findAttemptById.mockResolvedValue(mockAttemptWithAnswers); // userId: student-123

      await expect(
        service.getAttempt('lesson-123', 'attempt-123', otherStudentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when attemptId does not belong to this lesson (BOLA)', async () => {
      quizRepository.findLessonWithContext.mockResolvedValue(mockLesson);
      quizRepository.findAttemptById.mockResolvedValue({
        ...mockAttemptWithAnswers,
        lessonId: 'different-lesson',
      });

      await expect(service.getAttempt('lesson-123', 'attempt-123', studentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
