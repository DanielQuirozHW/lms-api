import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  Rubric,
  RubricAssessment,
  RubricAssessmentAnswer,
  RubricCriterion,
  RubricLevel,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type RubricWithCriteria = Rubric & {
  criteria: (RubricCriterion & { levels: RubricLevel[] })[];
};

export type RubricAssessmentWithAnswers = RubricAssessment & {
  answers: RubricAssessmentAnswer[];
};

@Injectable()
export class RubricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseId(courseId: string): Promise<Rubric[]> {
    return this.prisma.rubric.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByIdWithCriteria(id: string): Promise<RubricWithCriteria | null> {
    return this.prisma.rubric.findUnique({
      where: { id },
      include: {
        criteria: {
          orderBy: { order: 'asc' },
          include: { levels: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  findById(id: string): Promise<Rubric | null> {
    return this.prisma.rubric.findUnique({ where: { id } });
  }

  hasAssessments(rubricId: string): Promise<boolean> {
    return this.prisma.rubricAssessment.count({ where: { rubricId } }).then((n) => n > 0);
  }

  create(data: {
    courseId: string;
    title: string;
    description?: string;
    totalPoints: number;
    criteria: Array<{
      title: string;
      description?: string;
      order: number;
      points: number;
      levels: Array<{
        title: string;
        description?: string;
        points: number;
        order: number;
      }>;
    }>;
  }): Promise<RubricWithCriteria> {
    return this.prisma.rubric.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        description: data.description ?? null,
        totalPoints: data.totalPoints,
        criteria: {
          create: data.criteria.map((c) => ({
            title: c.title,
            description: c.description ?? null,
            order: c.order,
            points: c.points,
            levels: {
              create: c.levels.map((l) => ({
                title: l.title,
                description: l.description ?? null,
                points: l.points,
                order: l.order,
              })),
            },
          })),
        },
      },
      include: {
        criteria: {
          orderBy: { order: 'asc' },
          include: { levels: { orderBy: { order: 'asc' } } },
        },
      },
    });
  }

  update(id: string, data: Prisma.RubricUpdateInput): Promise<Rubric> {
    return this.prisma.rubric.update({ where: { id }, data });
  }

  delete(id: string): Promise<Rubric> {
    return this.prisma.rubric.delete({ where: { id } });
  }

  findAssessmentBySubmissionId(submissionId: string): Promise<RubricAssessmentWithAnswers | null> {
    return this.prisma.rubricAssessment.findUnique({
      where: { submissionId },
      include: { answers: true },
    });
  }

  createAssessment(data: {
    rubricId: string;
    submissionId: string;
    assessorId: string;
    totalScore: number;
    feedback?: string;
    answers: Array<{
      criterionId: string;
      levelId?: string;
      pointsAwarded: number;
      feedback?: string;
    }>;
  }): Promise<RubricAssessmentWithAnswers> {
    return this.prisma.rubricAssessment.create({
      data: {
        rubricId: data.rubricId,
        submissionId: data.submissionId,
        assessorId: data.assessorId,
        totalScore: data.totalScore,
        feedback: data.feedback ?? null,
        assessedAt: new Date(),
        answers: {
          create: data.answers.map((a) => ({
            criterionId: a.criterionId,
            levelId: a.levelId ?? null,
            pointsAwarded: a.pointsAwarded,
            feedback: a.feedback ?? null,
          })),
        },
      },
      include: { answers: true },
    });
  }

  findSubmissionById(
    submissionId: string,
  ): Promise<{ id: string; enrollmentId: string; enrollment: { courseId: string } } | null> {
    return this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        enrollmentId: true,
        enrollment: { select: { courseId: true } },
      },
    });
  }
}
