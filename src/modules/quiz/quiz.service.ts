import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LessonType, NotificationType, QuestionType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateQuizSettingsDto } from './dto/create-quiz-settings.dto';
import type { CreateQuestionDto } from './dto/create-question.dto';
import type { UpdateQuestionDto } from './dto/update-question.dto';
import type { SubmitAnswersDto } from './dto/submit-answers.dto';
import type {
  AttemptAnswerDto,
  AttemptResultDto,
  AttemptSummaryDto,
  QuestionOptionResponseDto,
  QuestionResponseDto,
  QuizSettingsResponseDto,
} from './dto/quiz-response.dto';
import {
  type AttemptWithAnswers,
  type LessonWithContext,
  type QuestionWithOptions,
  QuizRepository,
} from './quiz.repository';
import type { QuizAttempt, QuizSettings } from '@prisma/client';

const AUTO_GRADED_TYPES = new Set<QuestionType>([
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.SINGLE_CHOICE,
  QuestionType.TRUE_FALSE,
]);

@Injectable()
export class QuizService {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Creates or updates quiz settings for a lesson. Caller must be the course instructor or admin. */
  async upsertSettings(
    lessonId: string,
    dto: CreateQuizSettingsDto,
    user: AuthenticatedUser,
  ): Promise<QuizSettingsResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const settings = await this.quizRepository.upsertSettings(lessonId, {
      maxAttempts: dto.maxAttempts ?? null,
      passingScore: dto.passingScore ?? null,
      blocksProgress: dto.blocksProgress,
      shuffleQuestions: dto.shuffleQuestions,
    });
    return this.mapSettings(settings);
  }

  /** Returns quiz settings. Accessible by the instructor or any enrolled student. */
  async getSettings(lessonId: string, user: AuthenticatedUser): Promise<QuizSettingsResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    await this.assertAnyAccess(lesson, user);
    if (!lesson.quizSettings) throw new NotFoundException('Quiz settings not configured');
    return this.mapSettings(lesson.quizSettings);
  }

  /** Adds a question with options to the quiz. Caller must be the course instructor or admin. */
  async addQuestion(
    lessonId: string,
    dto: CreateQuestionDto,
    user: AuthenticatedUser,
  ): Promise<QuestionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const order = dto.order ?? (await this.quizRepository.findMaxQuestionOrder(lessonId)) + 1;
    const question = await this.quizRepository.addQuestion({
      lessonId,
      text: dto.text,
      type: dto.type,
      order,
      points: dto.points ?? 1,
      options: dto.options,
    });
    return this.mapQuestion(question, true);
  }

  /**
   * Lists questions. Instructors always see isCorrect on options.
   * Students only see isCorrect after completing at least one attempt.
   * Questions are shuffled for students if QuizSettings.shuffleQuestions is true.
   */
  async listQuestions(lessonId: string, user: AuthenticatedUser): Promise<QuestionResponseDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    const isInstructorOrAdmin = this.isInstructorOrAdmin(user);

    let showCorrect = isInstructorOrAdmin;
    let shouldShuffle = false;

    if (!isInstructorOrAdmin) {
      const enrollment = await this.quizRepository.findActiveEnrollment(
        user.id,
        lesson.module.courseId,
      );
      if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
      showCorrect = await this.quizRepository.hasCompletedAttempt(enrollment.id, lessonId);
      shouldShuffle = lesson.quizSettings?.shuffleQuestions ?? false;
    }

    const questions = await this.quizRepository.findQuestionsByLessonId(lessonId);
    const ordered: QuestionWithOptions[] = shouldShuffle
      ? [...questions].sort(() => Math.random() - 0.5)
      : questions;

    return ordered.map((q) => this.mapQuestion(q, showCorrect));
  }

  /** Updates a question and optionally replaces its options. Caller must be the course instructor or admin. */
  async updateQuestion(
    lessonId: string,
    id: string,
    dto: UpdateQuestionDto,
    user: AuthenticatedUser,
  ): Promise<QuestionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const existing = await this.quizRepository.findQuestionById(id, lessonId);
    if (!existing) throw new NotFoundException('Question not found');
    const updated = await this.quizRepository.updateQuestion(id, {
      text: dto.text,
      type: dto.type,
      order: dto.order,
      points: dto.points,
      options: dto.options,
    });
    return this.mapQuestion(updated, true);
  }

  /** Deletes a question. Caller must be the course instructor or admin. */
  async deleteQuestion(lessonId: string, id: string, user: AuthenticatedUser): Promise<void> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const existing = await this.quizRepository.findQuestionById(id, lessonId);
    if (!existing) throw new NotFoundException('Question not found');
    await this.quizRepository.deleteQuestion(id);
  }

  /**
   * Starts a new quiz attempt for the enrolled student.
   * Throws ConflictException if maxAttempts has been reached or there is an incomplete attempt.
   */
  async startAttempt(lessonId: string, user: AuthenticatedUser): Promise<AttemptSummaryDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    const enrollment = await this.quizRepository.findActiveEnrollment(
      user.id,
      lesson.module.courseId,
    );
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');

    const settings = lesson.quizSettings;
    if (settings?.maxAttempts != null) {
      const completed = await this.quizRepository.countCompletedAttempts(enrollment.id, lessonId);
      if (completed >= settings.maxAttempts) {
        throw new ConflictException('Maximum number of attempts reached');
      }
    }

    const incomplete = await this.quizRepository.findIncompleteAttempt(enrollment.id, lessonId);
    if (incomplete) {
      throw new ConflictException('You have an incomplete attempt in progress');
    }

    const maxNum = await this.quizRepository.findMaxAttemptNumber(enrollment.id, lessonId);
    const attempt = await this.quizRepository.createAttempt(enrollment.id, lessonId, maxNum + 1);
    return this.mapAttemptSummary(attempt, settings);
  }

  /** Returns all of the authenticated student's attempts for this lesson. */
  async getMyAttempts(lessonId: string, user: AuthenticatedUser): Promise<AttemptSummaryDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    const enrollment = await this.quizRepository.findActiveEnrollment(
      user.id,
      lesson.module.courseId,
    );
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    const attempts = await this.quizRepository.findAttemptsByEnrollment(enrollment.id, lessonId);
    return attempts.map((a) => this.mapAttemptSummary(a, lesson.quizSettings));
  }

  /**
   * Submits answers for an in-progress attempt and auto-grades auto-gradable questions.
   * After grading, notifies the student (QUIZ_PASSED or QUIZ_FAILED).
   * If the student passes and blocksProgress is set, marks the lesson complete and unlocks the next lesson.
   */
  async submitAttempt(
    lessonId: string,
    attemptId: string,
    dto: SubmitAnswersDto,
    user: AuthenticatedUser,
  ): Promise<AttemptResultDto> {
    const lesson = await this.getLessonOrFail(lessonId);

    const attempt = await this.quizRepository.findAttemptById(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.lessonId !== lessonId) throw new NotFoundException('Attempt not found');
    if (attempt.enrollment.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this attempt');
    }
    if (attempt.completedAt !== null) {
      throw new ConflictException('This attempt has already been submitted');
    }

    const questions = await this.quizRepository.findQuestionsByLessonId(lessonId);
    const score = this.calculateScore(questions, dto);
    const completedAt = new Date();
    await this.quizRepository.completeAttempt(attemptId, dto.answers, score, completedAt);

    const settings = lesson.quizSettings;
    const passed = settings?.passingScore != null ? score >= settings.passingScore : null;

    if (passed === true) {
      await this.quizRepository.completeLessonProgress(attempt.enrollmentId, lessonId);
      if (settings?.blocksProgress) {
        await this.quizRepository.unlockNextLesson(
          attempt.enrollmentId,
          lesson.module.id,
          lesson.order,
        );
      }
    }

    const notifType =
      passed === false ? NotificationType.QUIZ_FAILED : NotificationType.QUIZ_PASSED;
    const passLabel = passed === true ? 'passed' : passed === false ? 'failed' : 'submitted';
    void this.notificationsService.notify(
      user.id,
      notifType,
      `Quiz ${passLabel}`,
      `You ${passLabel} the quiz for this lesson.`,
      lessonId,
      'lesson',
    );

    const completed = await this.quizRepository.findAttemptById(attemptId);
    if (!completed) throw new NotFoundException('Attempt not found');
    return this.mapAttemptResult(completed, settings, true);
  }

  /**
   * Returns a single attempt with answers and results.
   * Students may only view their own attempts; instructors and admins may view any attempt.
   * isCorrect on answers is only shown when the attempt is complete or the caller is an instructor/admin.
   */
  async getAttempt(
    lessonId: string,
    attemptId: string,
    user: AuthenticatedUser,
  ): Promise<AttemptResultDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    const attempt = await this.quizRepository.findAttemptById(attemptId);
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.lessonId !== lessonId) throw new NotFoundException('Attempt not found');

    const isInstructorOrAdmin = this.isInstructorOrAdmin(user);
    if (isInstructorOrAdmin) {
      if (!user.roles.includes(UserRole.ADMIN) && lesson.module.course.instructorId !== user.id) {
        throw new ForbiddenException('You do not own this course');
      }
    } else {
      if (attempt.enrollment.userId !== user.id) {
        throw new ForbiddenException('You do not have access to this attempt');
      }
    }

    const showCorrect = attempt.completedAt !== null || isInstructorOrAdmin;
    return this.mapAttemptResult(attempt, lesson.quizSettings, showCorrect);
  }

  /** Returns all attempts for a lesson. Accessible by the course instructor and admins only. */
  async getAllAttempts(lessonId: string, user: AuthenticatedUser): Promise<AttemptSummaryDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const attempts = await this.quizRepository.findAllAttemptsByLesson(lessonId);
    return attempts.map((a) => this.mapAttemptSummary(a, lesson.quizSettings));
  }

  private async getLessonOrFail(lessonId: string): Promise<LessonWithContext> {
    const lesson = await this.quizRepository.findLessonWithContext(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.type !== LessonType.QUIZ) throw new BadRequestException('Lesson is not a quiz');
    return lesson;
  }

  private assertInstructorAccess(lesson: LessonWithContext, user: AuthenticatedUser): void {
    if (!user.roles.includes(UserRole.ADMIN) && lesson.module.course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  private async assertAnyAccess(lesson: LessonWithContext, user: AuthenticatedUser): Promise<void> {
    if (this.isInstructorOrAdmin(user)) return;
    const enrollment = await this.quizRepository.findActiveEnrollment(
      user.id,
      lesson.module.courseId,
    );
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
  }

  private isInstructorOrAdmin(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
  }

  private calculateScore(questions: QuestionWithOptions[], dto: SubmitAnswersDto): number {
    const answerMap = new Map(dto.answers.map((a) => [a.questionId, a]));
    let earned = 0;
    let total = 0;
    for (const q of questions) {
      if (!AUTO_GRADED_TYPES.has(q.type)) continue;
      total += q.points;
      const answer = answerMap.get(q.id);
      if (answer?.selectedOptionId) {
        const option = q.options.find((o) => o.id === answer.selectedOptionId);
        if (option?.isCorrect) earned += q.points;
      }
    }
    return total > 0 ? (earned / total) * 100 : 0;
  }

  private mapSettings(settings: QuizSettings): QuizSettingsResponseDto {
    return {
      id: settings.id,
      lessonId: settings.lessonId,
      maxAttempts: settings.maxAttempts,
      passingScore: settings.passingScore,
      blocksProgress: settings.blocksProgress,
      shuffleQuestions: settings.shuffleQuestions,
    };
  }

  private mapQuestion(q: QuestionWithOptions, showCorrect: boolean): QuestionResponseDto {
    const options: QuestionOptionResponseDto[] = q.options.map((o) => ({
      id: o.id,
      text: o.text,
      order: o.order,
      ...(showCorrect && { isCorrect: o.isCorrect }),
    }));
    return {
      id: q.id,
      lessonId: q.lessonId,
      text: q.text,
      type: q.type,
      order: q.order,
      points: q.points,
      options,
    };
  }

  private mapAttemptSummary(
    attempt: QuizAttempt,
    settings: QuizSettings | null,
  ): AttemptSummaryDto {
    const passed =
      attempt.score !== null && settings?.passingScore != null
        ? attempt.score >= settings.passingScore
        : null;
    return {
      id: attempt.id,
      lessonId: attempt.lessonId,
      enrollmentId: attempt.enrollmentId,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      passed,
    };
  }

  private mapAttemptResult(
    attempt: AttemptWithAnswers,
    settings: QuizSettings | null,
    showCorrect: boolean,
  ): AttemptResultDto {
    const summary = this.mapAttemptSummary(attempt, settings);
    const answers: AttemptAnswerDto[] = attempt.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      selectedOptionId: a.selectedOptionId,
      textAnswer: a.textAnswer,
      isCorrect: showCorrect && a.selectedOption !== null ? a.selectedOption.isCorrect : null,
    }));
    return {
      id: summary.id,
      lessonId: summary.lessonId,
      enrollmentId: summary.enrollmentId,
      attemptNumber: summary.attemptNumber,
      score: summary.score,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      passed: summary.passed,
      answers,
    };
  }
}
