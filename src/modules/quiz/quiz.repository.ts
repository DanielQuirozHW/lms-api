import { Injectable } from '@nestjs/common';
import type {
  Enrollment,
  Lesson,
  Question,
  QuestionOption,
  QuizAnswer,
  QuizAttempt,
  QuizSettings,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonWithContext = Lesson & {
  module: {
    id: string;
    courseId: string;
    course: { instructorId: string };
  };
  quizSettings: QuizSettings | null;
};

export type QuestionWithOptions = Question & {
  options: QuestionOption[];
};

export type AttemptWithAnswers = QuizAttempt & {
  enrollment: Pick<Enrollment, 'userId'>;
  answers: (QuizAnswer & {
    question: Pick<Question, 'type' | 'points'>;
    selectedOption: Pick<QuestionOption, 'isCorrect'> | null;
  })[];
};

@Injectable()
export class QuizRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findLessonWithContext(lessonId: string): Promise<LessonWithContext | null> {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          select: {
            id: true,
            courseId: true,
            course: { select: { instructorId: true } },
          },
        },
        quizSettings: true,
      },
    });
  }

  upsertSettings(
    lessonId: string,
    data: {
      maxAttempts?: number | null;
      passingScore?: number | null;
      blocksProgress?: boolean;
      shuffleQuestions?: boolean;
    },
  ): Promise<QuizSettings> {
    return this.prisma.quizSettings.upsert({
      where: { lessonId },
      create: {
        lesson: { connect: { id: lessonId } },
        maxAttempts: data.maxAttempts ?? null,
        passingScore: data.passingScore ?? null,
        blocksProgress: data.blocksProgress ?? false,
        shuffleQuestions: data.shuffleQuestions ?? false,
      },
      update: {
        ...(data.maxAttempts !== undefined && { maxAttempts: data.maxAttempts }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
        ...(data.blocksProgress !== undefined && { blocksProgress: data.blocksProgress }),
        ...(data.shuffleQuestions !== undefined && { shuffleQuestions: data.shuffleQuestions }),
      },
    });
  }

  async findMaxQuestionOrder(lessonId: string): Promise<number> {
    const result = await this.prisma.question.aggregate({
      where: { lessonId },
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  addQuestion(data: {
    lessonId: string;
    text: string;
    type: Question['type'];
    order: number;
    points: number;
    options?: { text: string; isCorrect: boolean; order: number }[];
  }): Promise<QuestionWithOptions> {
    return this.prisma.question.create({
      data: {
        lesson: { connect: { id: data.lessonId } },
        text: data.text,
        type: data.type,
        order: data.order,
        points: data.points,
        ...(data.options && {
          options: {
            create: data.options.map((o) => ({
              text: o.text,
              isCorrect: o.isCorrect,
              order: o.order,
            })),
          },
        }),
      },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  findQuestionsByLessonId(lessonId: string): Promise<QuestionWithOptions[]> {
    return this.prisma.question.findMany({
      where: { lessonId },
      include: { options: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
  }

  findQuestionById(id: string, lessonId: string): Promise<QuestionWithOptions | null> {
    return this.prisma.question.findFirst({
      where: { id, lessonId },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  async updateQuestion(
    id: string,
    data: {
      text?: string;
      type?: Question['type'];
      order?: number;
      points?: number;
      options?: { text: string; isCorrect: boolean; order: number }[];
    },
  ): Promise<QuestionWithOptions> {
    return this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id },
        data: {
          ...(data.text !== undefined && { text: data.text }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.order !== undefined && { order: data.order }),
          ...(data.points !== undefined && { points: data.points }),
        },
      });
      if (data.options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        if (data.options.length > 0) {
          await tx.questionOption.createMany({
            data: data.options.map((o) => ({
              questionId: id,
              text: o.text,
              isCorrect: o.isCorrect,
              order: o.order,
            })),
          });
        }
      }
      const result = await tx.question.findUnique({
        where: { id },
        include: { options: { orderBy: { order: 'asc' } } },
      });
      return result as QuestionWithOptions;
    });
  }

  deleteQuestion(id: string): Promise<Question> {
    return this.prisma.question.delete({ where: { id } });
  }

  findActiveEnrollment(userId: string, courseId: string): Promise<Pick<Enrollment, 'id'> | null> {
    return this.prisma.enrollment.findFirst({
      where: { userId, courseId, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  countCompletedAttempts(enrollmentId: string, lessonId: string): Promise<number> {
    return this.prisma.quizAttempt.count({
      where: { enrollmentId, lessonId, completedAt: { not: null } },
    });
  }

  findIncompleteAttempt(enrollmentId: string, lessonId: string): Promise<QuizAttempt | null> {
    return this.prisma.quizAttempt.findFirst({
      where: { enrollmentId, lessonId, completedAt: null },
    });
  }

  async findMaxAttemptNumber(enrollmentId: string, lessonId: string): Promise<number> {
    const result = await this.prisma.quizAttempt.aggregate({
      where: { enrollmentId, lessonId },
      _max: { attemptNumber: true },
    });
    return result._max.attemptNumber ?? 0;
  }

  createAttempt(
    enrollmentId: string,
    lessonId: string,
    attemptNumber: number,
  ): Promise<QuizAttempt> {
    return this.prisma.quizAttempt.create({
      data: {
        enrollment: { connect: { id: enrollmentId } },
        lesson: { connect: { id: lessonId } },
        attemptNumber,
      },
    });
  }

  findAttemptsByEnrollment(enrollmentId: string, lessonId: string): Promise<QuizAttempt[]> {
    return this.prisma.quizAttempt.findMany({
      where: { enrollmentId, lessonId },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  findAttemptById(id: string): Promise<AttemptWithAnswers | null> {
    return this.prisma.quizAttempt.findUnique({
      where: { id },
      include: {
        enrollment: { select: { userId: true } },
        answers: {
          include: {
            question: { select: { type: true, points: true } },
            selectedOption: { select: { isCorrect: true } },
          },
        },
      },
    });
  }

  async completeAttempt(
    id: string,
    answers: { questionId: string; selectedOptionId?: string; textAnswer?: string }[],
    score: number,
    completedAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<QuizAttempt> {
    const client = tx ?? this.prisma;
    if (answers.length > 0) {
      await client.quizAnswer.createMany({
        data: answers.map((a) => ({
          attemptId: id,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId ?? null,
          textAnswer: a.textAnswer ?? null,
        })),
      });
    }
    return client.quizAttempt.update({
      where: { id },
      data: { score, completedAt },
    });
  }

  async completeLessonProgress(
    enrollmentId: string,
    lessonId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      update: { completedAt: new Date() },
      create: { enrollmentId, lessonId, completedAt: new Date() },
    });
  }

  async unlockNextLesson(
    enrollmentId: string,
    moduleId: string,
    currentOrder: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const next = await client.lesson.findFirst({
      where: { moduleId, order: { gt: currentOrder } },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    if (!next) return;
    await client.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId: next.id } },
      update: { isLocked: false },
      create: { enrollmentId, lessonId: next.id, isLocked: false },
    });
  }

  findAllAttemptsByLesson(
    lessonId: string,
  ): Promise<(QuizAttempt & { enrollment: Pick<Enrollment, 'userId'> })[]> {
    return this.prisma.quizAttempt.findMany({
      where: { lessonId },
      include: { enrollment: { select: { userId: true } } },
      orderBy: [{ enrollmentId: 'asc' }, { attemptNumber: 'asc' }],
    });
  }

  hasCompletedAttempt(enrollmentId: string, lessonId: string): Promise<boolean> {
    return this.prisma.quizAttempt
      .findFirst({
        where: { enrollmentId, lessonId, completedAt: { not: null } },
        select: { id: true },
      })
      .then((a) => a !== null);
  }
}
