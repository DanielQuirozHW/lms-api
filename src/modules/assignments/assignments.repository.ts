import { Injectable } from '@nestjs/common';
import type { AssignmentSettings, Enrollment, Lesson, Submission } from '@prisma/client';
import { Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonWithAssignmentContext = Lesson & {
  module: {
    id: string;
    courseId: string;
    course: { instructorId: string };
  };
  assignmentSettings: AssignmentSettings | null;
};

export type SubmissionWithContext = Submission & {
  enrollment: { userId: string; courseId: string };
};

@Injectable()
export class AssignmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findLessonWithContext(lessonId: string): Promise<LessonWithAssignmentContext | null> {
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
        assignmentSettings: true,
      },
    });
  }

  upsertSettings(
    lessonId: string,
    data: {
      gradingType: AssignmentSettings['gradingType'];
      maxScore: number;
      passingScore?: number | null;
      dueDate?: Date | null;
      allowLateSubmission?: boolean;
      isGroupAssignment?: boolean;
      groupId?: string | null;
      maxAttempts?: number | null;
    },
  ): Promise<AssignmentSettings> {
    const common = {
      gradingType: data.gradingType,
      maxScore: data.maxScore,
      passingScore: data.passingScore ?? null,
      dueDate: data.dueDate ?? null,
      allowLateSubmission: data.allowLateSubmission ?? false,
      isGroupAssignment: data.isGroupAssignment ?? false,
      groupId: data.groupId ?? null,
      maxAttempts: data.maxAttempts ?? null,
    };
    return this.prisma.assignmentSettings.upsert({
      where: { lessonId },
      create: { lessonId, ...common },
      update: common,
    });
  }

  findActiveEnrollment(userId: string, courseId: string): Promise<Pick<Enrollment, 'id'> | null> {
    return this.prisma.enrollment.findFirst({
      where: { userId, courseId, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  countSubmissions(enrollmentId: string, lessonId: string): Promise<number> {
    return this.prisma.submission.count({ where: { enrollmentId, lessonId } });
  }

  createSubmission(data: {
    enrollmentId: string;
    lessonId: string;
    content: string;
    fileUrl?: string | null;
    attemptNumber: number;
    grade?: number | null;
    gradedAt?: Date | null;
    groupId?: string | null;
    status?: SubmissionStatus;
  }): Promise<Submission> {
    return this.prisma.submission.create({
      data: {
        enrollmentId: data.enrollmentId,
        lessonId: data.lessonId,
        content: data.content,
        fileUrl: data.fileUrl ?? null,
        attemptNumber: data.attemptNumber,
        grade: data.grade ?? null,
        gradedAt: data.gradedAt ?? null,
        groupId: data.groupId ?? null,
        status: data.status ?? SubmissionStatus.SUBMITTED,
      },
    });
  }

  findSubmissionsByLesson(lessonId: string): Promise<SubmissionWithContext[]> {
    return this.prisma.submission.findMany({
      where: { lessonId },
      include: { enrollment: { select: { userId: true, courseId: true } } },
      orderBy: { submittedAt: 'desc' },
    });
  }

  findSubmissionsByEnrollment(enrollmentId: string, lessonId: string): Promise<Submission[]> {
    return this.prisma.submission.findMany({
      where: { enrollmentId, lessonId },
      orderBy: { attemptNumber: 'asc' },
    });
  }

  findSubmissionById(id: string): Promise<SubmissionWithContext | null> {
    return this.prisma.submission.findUnique({
      where: { id },
      include: { enrollment: { select: { userId: true, courseId: true } } },
    });
  }

  updateSubmission(
    id: string,
    data: {
      grade: number;
      feedback?: string | null;
      gradedById: string;
      gradedAt: Date;
      status?: SubmissionStatus;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<Submission> {
    const client = tx ?? this.prisma;
    return client.submission.update({
      where: { id },
      data: {
        grade: data.grade,
        feedback: data.feedback ?? null,
        gradedById: data.gradedById,
        gradedAt: data.gradedAt,
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  updateSubmissionStatus(
    id: string,
    status: SubmissionStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Submission> {
    const client = tx ?? this.prisma;
    return client.submission.update({ where: { id }, data: { status } });
  }

  findPendingSubmissions(lessonId: string): Promise<SubmissionWithContext[]> {
    return this.prisma.submission.findMany({
      where: { lessonId, grade: null },
      include: { enrollment: { select: { userId: true, courseId: true } } },
      orderBy: { submittedAt: 'asc' },
    });
  }

  findUserGroupId(userId: string, courseId: string): Promise<string | null> {
    return this.prisma.courseGroupMember
      .findFirst({
        where: { userId, group: { courseId } },
        select: { groupId: true },
      })
      .then((m) => m?.groupId ?? null);
  }

  findSubmissionsByGroupAndLesson(groupId: string, lessonId: string): Promise<Submission[]> {
    return this.prisma.submission.findMany({ where: { groupId, lessonId } });
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
}
