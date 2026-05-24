import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Rubric } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import type { CreateRubricAssessmentDto } from './dto/create-rubric-assessment.dto';
import type { CreateRubricDto } from './dto/create-rubric.dto';
import type {
  RubricAssessmentResponseDto,
  RubricResponseDto,
  RubricSummaryResponseDto,
} from './dto/rubric-response.dto';
import type { UpdateRubricDto } from './dto/update-rubric.dto';
import {
  type RubricAssessmentWithAnswers,
  type RubricWithCriteria,
  RubricsRepository,
} from './rubrics.repository';

@Injectable()
export class RubricsService {
  constructor(
    private readonly rubricsRepository: RubricsRepository,
    private readonly coursesService: CoursesService,
  ) {}

  /** Returns all rubrics for a course. Verifies course visibility for the caller. */
  async findAll(courseId: string, user: AuthenticatedUser): Promise<RubricSummaryResponseDto[]> {
    await this.coursesService.findOne(courseId, user);
    const rubrics = await this.rubricsRepository.findByCourseId(courseId);
    return rubrics.map((r) => this.mapSummary(r));
  }

  /** Returns a single rubric with full criteria and levels. Verifies course visibility and rubric ownership to course. */
  async findOne(courseId: string, id: string, user: AuthenticatedUser): Promise<RubricResponseDto> {
    await this.coursesService.findOne(courseId, user);
    const rubric = await this.rubricsRepository.findByIdWithCriteria(id);
    if (!rubric || rubric.courseId !== courseId) {
      throw new NotFoundException('Rubric not found');
    }
    return this.map(rubric);
  }

  /** Creates a rubric with nested criteria and levels. Only the course owner or admin may create. */
  async create(
    courseId: string,
    dto: CreateRubricDto,
    user: AuthenticatedUser,
  ): Promise<RubricResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const rubric = await this.rubricsRepository.create({
      courseId,
      title: dto.title,
      description: dto.description,
      totalPoints: dto.totalPoints,
      criteria: dto.criteria.map((c) => ({
        title: c.title,
        description: c.description,
        order: c.order,
        points: c.points,
        levels: c.levels.map((l) => ({
          title: l.title,
          description: l.description,
          points: l.points,
          order: l.order,
        })),
      })),
    });

    return this.map(rubric);
  }

  /** Updates rubric title, description, and/or totalPoints. Criteria are not modified here. */
  async update(
    courseId: string,
    id: string,
    dto: UpdateRubricDto,
    user: AuthenticatedUser,
  ): Promise<RubricResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const existing = await this.rubricsRepository.findById(id);
    if (!existing || existing.courseId !== courseId) {
      throw new NotFoundException('Rubric not found');
    }

    await this.rubricsRepository.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.totalPoints !== undefined && { totalPoints: dto.totalPoints }),
    });

    const updated = await this.rubricsRepository.findByIdWithCriteria(id);
    if (!updated) throw new NotFoundException('Rubric not found');
    return this.map(updated);
  }

  /** Deletes a rubric. Throws ConflictException if any assessments exist for this rubric. */
  async delete(courseId: string, id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const existing = await this.rubricsRepository.findById(id);
    if (!existing || existing.courseId !== courseId) {
      throw new NotFoundException('Rubric not found');
    }

    const hasAssessments = await this.rubricsRepository.hasAssessments(id);
    if (hasAssessments) {
      throw new ConflictException('Cannot delete rubric with existing assessments');
    }

    await this.rubricsRepository.delete(id);
  }

  /**
   * Creates an assessment for a submission using a rubric.
   * Caller must be the course instructor or admin.
   * Validates that the rubric belongs to the course, the submission belongs to an enrollment in the same course,
   * and all criterionIds in the answers belong to this rubric.
   * totalScore is calculated as the sum of all answers' pointsAwarded.
   */
  async createAssessment(
    courseId: string,
    rubricId: string,
    submissionId: string,
    dto: CreateRubricAssessmentDto,
    user: AuthenticatedUser,
  ): Promise<RubricAssessmentResponseDto> {
    // C-2: verify caller owns this course
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const rubric = await this.rubricsRepository.findByIdWithCriteria(rubricId);
    if (!rubric || rubric.courseId !== courseId) {
      throw new NotFoundException('Rubric not found');
    }

    const submission = await this.rubricsRepository.findSubmissionById(submissionId);
    if (!submission || submission.enrollment.courseId !== courseId) {
      throw new NotFoundException('Submission not found');
    }

    // M-6: validate all criterionIds belong to this rubric
    const validCriterionIds = new Set(rubric.criteria.map((c) => c.id));
    for (const answer of dto.answers) {
      if (!validCriterionIds.has(answer.criterionId)) {
        throw new BadRequestException(
          `Criterion ${answer.criterionId} does not belong to this rubric`,
        );
      }
    }

    const totalScore = dto.answers.reduce((sum, a) => sum + a.pointsAwarded, 0);

    const assessment = await this.rubricsRepository.createAssessment({
      rubricId,
      submissionId,
      assessorId: user.id,
      totalScore,
      feedback: dto.feedback,
      answers: dto.answers.map((a) => ({
        criterionId: a.criterionId,
        levelId: a.levelId,
        pointsAwarded: a.pointsAwarded,
        feedback: a.feedback,
      })),
    });

    return this.mapAssessment(assessment);
  }

  /**
   * Returns the rubric assessment for a submission.
   * Caller must be either the submission owner (student) or the course instructor/admin.
   */
  async getAssessment(
    courseId: string,
    rubricId: string,
    submissionId: string,
    user: AuthenticatedUser,
  ): Promise<RubricAssessmentResponseDto> {
    const rubric = await this.rubricsRepository.findById(rubricId);
    if (!rubric || rubric.courseId !== courseId) {
      throw new NotFoundException('Rubric not found');
    }

    // Verify caller can view this course (gates DRAFT/ARCHIVED visibility)
    const course = await this.coursesService.findOne(courseId, user);

    // C-3: instructors must own this course; students must own this submission
    const isInstructorOrAdmin =
      user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.INSTRUCTOR);
    if (isInstructorOrAdmin) {
      if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
        throw new ForbiddenException('You do not own this course');
      }
    } else {
      const submission = await this.rubricsRepository.findSubmissionById(submissionId);
      if (!submission || submission.enrollment.userId !== user.id) {
        throw new ForbiddenException('You do not have access to this assessment');
      }
    }

    const assessment = await this.rubricsRepository.findAssessmentBySubmissionId(submissionId);
    if (!assessment || assessment.rubricId !== rubricId) {
      throw new NotFoundException('Assessment not found');
    }

    return this.mapAssessment(assessment);
  }

  private verifyOwnership(course: CourseDetailResponseDto, user: AuthenticatedUser): void {
    if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
      throw new ForbiddenException('Only the course owner or an admin can perform this action');
    }
  }

  private map(rubric: RubricWithCriteria): RubricResponseDto {
    return {
      id: rubric.id,
      courseId: rubric.courseId,
      title: rubric.title,
      description: rubric.description,
      totalPoints: rubric.totalPoints,
      criteria: rubric.criteria.map((c) => ({
        id: c.id,
        rubricId: c.rubricId,
        title: c.title,
        description: c.description,
        order: c.order,
        points: c.points,
        levels: c.levels.map((l) => ({
          id: l.id,
          criterionId: l.criterionId,
          title: l.title,
          description: l.description,
          points: l.points,
          order: l.order,
        })),
      })),
      createdAt: rubric.createdAt,
      updatedAt: rubric.updatedAt,
    };
  }

  private mapSummary(rubric: Rubric): RubricSummaryResponseDto {
    return {
      id: rubric.id,
      courseId: rubric.courseId,
      title: rubric.title,
      description: rubric.description,
      totalPoints: rubric.totalPoints,
      createdAt: rubric.createdAt,
      updatedAt: rubric.updatedAt,
    };
  }

  private mapAssessment(assessment: RubricAssessmentWithAnswers): RubricAssessmentResponseDto {
    return {
      id: assessment.id,
      rubricId: assessment.rubricId,
      submissionId: assessment.submissionId,
      assessorId: assessment.assessorId,
      totalScore: assessment.totalScore,
      feedback: assessment.feedback,
      assessedAt: assessment.assessedAt,
      answers: assessment.answers.map((a) => ({
        id: a.id,
        assessmentId: a.assessmentId,
        criterionId: a.criterionId,
        levelId: a.levelId,
        pointsAwarded: a.pointsAwarded,
        feedback: a.feedback,
      })),
    };
  }
}
