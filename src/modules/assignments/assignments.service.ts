import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GradingType,
  LessonType,
  NotificationType,
  SubmissionStatus,
  UserRole,
} from '@prisma/client';
import type { AssignmentSettings, Submission } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { RubricAssessmentPayload } from '../rubrics/rubrics.service';
import { RubricsService } from '../rubrics/rubrics.service';
import type { CreateAssignmentSettingsDto } from './dto/create-assignment-settings.dto';
import type { GradeSubmissionDto } from './dto/grade-submission.dto';
import type { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import type {
  AssignmentSettingsResponseDto,
  SubmissionResponseDto,
} from './dto/assignment-response.dto';
import { type LessonWithAssignmentContext, AssignmentsRepository } from './assignments.repository';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly rubricsService: RubricsService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  /** Creates or updates assignment settings for a lesson. Caller must be the course instructor or admin. */
  async upsertSettings(
    lessonId: string,
    dto: CreateAssignmentSettingsDto,
    user: AuthenticatedUser,
  ): Promise<AssignmentSettingsResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const settings = await this.assignmentsRepository.upsertSettings(lessonId, {
      gradingType: dto.gradingType,
      maxScore: dto.maxScore,
      passingScore: dto.passingScore ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      allowLateSubmission: dto.allowLateSubmission ?? false,
      isGroupAssignment: dto.isGroupAssignment ?? false,
      groupId: dto.groupId ?? null,
      maxAttempts: dto.maxAttempts ?? null,
    });
    return this.mapSettings(settings);
  }

  /** Returns assignment settings. Accessible by the instructor or any enrolled student. */
  async getSettings(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<AssignmentSettingsResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    await this.assertAnyAccess(lesson, user);
    if (!lesson.assignmentSettings) throw new NotFoundException('Assignment not configured');
    return this.mapSettings(lesson.assignmentSettings);
  }

  /**
   * Submits an assignment for the enrolled student.
   * For AUTOMATIC grading, grade is set to maxScore on submission.
   * Due date and late submission rules are enforced.
   * Group assignments attach the student's groupId to the submission.
   */
  async submit(
    lessonId: string,
    dto: SubmitAssignmentDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    const courseId = lesson.module.courseId;

    const enrollment = await this.assignmentsRepository.findActiveEnrollment(user.id, courseId);
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');

    const settings = lesson.assignmentSettings;
    if (!settings) throw new BadRequestException('Assignment not configured');

    // M-3: validate fileUrl is scoped to the configured CDN (prevents arbitrary external links)
    if (dto.fileUrl) {
      const r2PublicUrl = this.configService.get<string>('r2.publicUrl' as keyof AppConfig);
      if (r2PublicUrl && !dto.fileUrl.startsWith(r2PublicUrl)) {
        throw new BadRequestException('fileUrl must reference a file uploaded to this platform');
      }
    }

    const now = new Date();
    if (settings.dueDate && now > settings.dueDate && !settings.allowLateSubmission) {
      throw new BadRequestException('The due date has passed and late submissions are not allowed');
    }

    let groupId: string | null = null;
    if (settings.isGroupAssignment) {
      groupId = await this.assignmentsRepository.findUserGroupId(user.id, courseId);
    }

    const existing = await this.assignmentsRepository.countSubmissions(enrollment.id, lessonId);
    const limit = settings.maxAttempts ?? 10;
    if (existing >= limit) {
      throw new ConflictException('Maximum submission attempts reached');
    }
    const attemptNumber = existing + 1;

    const autoGrade = settings.gradingType === GradingType.AUTOMATIC ? settings.maxScore : null;
    const gradedAt = autoGrade !== null ? now : null;

    const submission = await this.assignmentsRepository.createSubmission({
      enrollmentId: enrollment.id,
      lessonId,
      content: dto.content,
      fileUrl: dto.fileUrl ?? null,
      attemptNumber,
      grade: autoGrade,
      gradedAt,
      groupId,
      status: SubmissionStatus.SUBMITTED,
    });

    if (settings.gradingType === GradingType.AUTOMATIC) {
      const passed =
        settings.passingScore !== null ? (autoGrade as number) >= settings.passingScore : null;
      if (passed === true) {
        await this.assignmentsRepository.completeLessonProgress(enrollment.id, lessonId);
      }
      void this.notificationsService.notify(
        user.id,
        NotificationType.ASSIGNMENT_GRADED,
        'Assignment graded',
        `Your assignment has been automatically graded. Score: ${String(autoGrade)}/${String(settings.maxScore)}`,
        submission.id,
        'submission',
      );
    }

    return this.mapSubmission(submission);
  }

  /** Returns all submissions for a lesson. Only the course instructor or admin may access. */
  async getSubmissions(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const submissions = await this.assignmentsRepository.findSubmissionsByLesson(lessonId);
    return submissions.map((s) => this.mapSubmission(s));
  }

  /** Returns the calling student's own submissions for a lesson. */
  async getMySubmissions(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    const courseId = lesson.module.courseId;
    const enrollment = await this.assignmentsRepository.findActiveEnrollment(user.id, courseId);
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
    const submissions = await this.assignmentsRepository.findSubmissionsByEnrollment(
      enrollment.id,
      lessonId,
    );
    return submissions.map((s) => this.mapSubmission(s));
  }

  /**
   * Returns a single submission.
   * Instructors and admins may view any submission for their course.
   * Students may only view their own submissions.
   */
  async getSubmission(
    lessonId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    const submission = await this.assignmentsRepository.findSubmissionById(submissionId);
    if (!submission || submission.lessonId !== lessonId) {
      throw new NotFoundException('Submission not found');
    }

    if (this.isInstructorOrAdmin(user)) {
      if (!user.roles.includes(UserRole.ADMIN) && lesson.module.course.instructorId !== user.id) {
        throw new ForbiddenException('You do not own this course');
      }
    } else {
      if (submission.enrollment.userId !== user.id) {
        throw new ForbiddenException('You do not have access to this submission');
      }
    }

    return this.mapSubmission(submission);
  }

  /**
   * Grades a submission. If the lesson has a rubricId and rubricAnswers are provided, creates a RubricAssessment.
   * On pass (grade >= passingScore), marks lesson progress complete for the submission owner and all group members.
   * Notifies the student via ASSIGNMENT_GRADED.
   * Propagates the grade to all other group members' submissions when groupId is set.
   *
   * Write ordering: rubric inputs are validated (reads only) before the transaction, then the rubric
   * assessment write + all grade writes (primary submission + group propagation + lesson progress) are
   * committed in a single atomic transaction — no orphaned assessment on failure.
   */
  async gradeSubmission(
    lessonId: string,
    submissionId: string,
    dto: GradeSubmissionDto,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);

    const submission = await this.assignmentsRepository.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.lessonId !== lessonId) throw new NotFoundException('Submission not found');

    const gradedAt = new Date();
    const settings = lesson.assignmentSettings;
    const passed = settings?.passingScore != null ? dto.grade >= settings.passingScore : null;

    // Validate rubric inputs before the transaction (reads only). The write goes inside.
    let rubricPayload: RubricAssessmentPayload | null = null;
    if (lesson.rubricId && dto.rubricAnswers && dto.rubricAnswers.length > 0) {
      rubricPayload = await this.rubricsService.prepareAssessmentValidation(
        lesson.module.courseId,
        lesson.rubricId,
        submissionId,
        {
          feedback: dto.feedback,
          answers: dto.rubricAnswers.map((a) => ({
            criterionId: a.criterionId,
            levelId: a.levelId,
            pointsAwarded: a.pointsAwarded,
            feedback: a.feedback,
          })),
        },
        user,
      );
    }

    // Fetch group members before the transaction (read-only, no concurrent grading expected).
    const otherSubmissions = submission.groupId
      ? (
          await this.assignmentsRepository.findSubmissionsByGroupAndLesson(
            submission.groupId,
            lessonId,
          )
        ).filter((s) => s.id !== submissionId)
      : [];

    const gradePayload = {
      grade: dto.grade,
      feedback: dto.feedback ?? null,
      gradedById: user.id,
      gradedAt,
      status: SubmissionStatus.GRADED,
    };

    // Atomic: rubric assessment + grade primary submission + group member submissions + lesson progress.
    const updated = await this.assignmentsRepository.transaction(async (tx) => {
      if (rubricPayload) {
        await this.rubricsService.createAssessmentInTx(rubricPayload, tx);
      }

      const graded = await this.assignmentsRepository.updateSubmission(
        submissionId,
        gradePayload,
        tx,
      );

      if (passed === true) {
        await this.assignmentsRepository.completeLessonProgress(
          submission.enrollmentId,
          lessonId,
          tx,
        );
      }

      for (const other of otherSubmissions) {
        await this.assignmentsRepository.updateSubmission(other.id, gradePayload, tx);
        if (passed === true) {
          await this.assignmentsRepository.completeLessonProgress(other.enrollmentId, lessonId, tx);
        }
      }

      return graded;
    });

    void this.notificationsService.notify(
      submission.enrollment.userId,
      NotificationType.ASSIGNMENT_GRADED,
      'Assignment graded',
      `Your assignment has been graded. Score: ${String(dto.grade)}${settings ? `/${String(settings.maxScore)}` : ''}`,
      submissionId,
      'submission',
    );

    return this.mapSubmission(updated);
  }

  /** Updates the status of a submission. Used to set RETURNED when an instructor sends back for revision. */
  async updateStatus(
    lessonId: string,
    submissionId: string,
    status: SubmissionStatus,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);

    const submission = await this.assignmentsRepository.findSubmissionById(submissionId);
    if (!submission || submission.lessonId !== lessonId) {
      throw new NotFoundException('Submission not found');
    }

    const updated = await this.assignmentsRepository.updateSubmissionStatus(submissionId, status);
    return this.mapSubmission(updated);
  }

  /** Returns all ungraded submissions for a lesson. Only the course instructor or admin may access. */
  async getPendingSubmissions(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    const lesson = await this.getLessonOrFail(lessonId);
    this.assertInstructorAccess(lesson, user);
    const submissions = await this.assignmentsRepository.findPendingSubmissions(lessonId);
    return submissions.map((s) => this.mapSubmission(s));
  }

  private async getLessonOrFail(lessonId: string): Promise<LessonWithAssignmentContext> {
    const lesson = await this.assignmentsRepository.findLessonWithContext(lessonId);
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.type !== LessonType.ASSIGNMENT) {
      throw new BadRequestException('Lesson is not an assignment');
    }
    return lesson;
  }

  private assertInstructorAccess(
    lesson: LessonWithAssignmentContext,
    user: AuthenticatedUser,
  ): void {
    if (!user.roles.includes(UserRole.ADMIN) && lesson.module.course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  private async assertAnyAccess(
    lesson: LessonWithAssignmentContext,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (this.isInstructorOrAdmin(user)) return;
    const enrollment = await this.assignmentsRepository.findActiveEnrollment(
      user.id,
      lesson.module.courseId,
    );
    if (!enrollment) throw new ForbiddenException('You are not enrolled in this course');
  }

  private isInstructorOrAdmin(user: AuthenticatedUser): boolean {
    return user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
  }

  private mapSettings(settings: AssignmentSettings): AssignmentSettingsResponseDto {
    return {
      id: settings.id,
      lessonId: settings.lessonId,
      gradingType: settings.gradingType,
      maxScore: settings.maxScore,
      passingScore: settings.passingScore,
      dueDate: settings.dueDate,
      allowLateSubmission: settings.allowLateSubmission,
      isGroupAssignment: settings.isGroupAssignment,
      groupId: settings.groupId,
      maxAttempts: settings.maxAttempts,
    };
  }

  private mapSubmission(submission: Submission): SubmissionResponseDto {
    return {
      id: submission.id,
      enrollmentId: submission.enrollmentId,
      lessonId: submission.lessonId,
      content: submission.content,
      fileUrl: submission.fileUrl,
      submittedAt: submission.createdAt,
      attemptNumber: submission.attemptNumber,
      status: submission.status,
      grade: submission.grade,
      feedback: submission.feedback,
      gradedById: submission.gradedById,
      gradedAt: submission.gradedAt,
      groupId: submission.groupId,
    };
  }
}
