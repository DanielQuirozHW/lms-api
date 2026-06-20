import { Injectable } from '@nestjs/common';
import type {
  AssignmentSettings,
  Course,
  CourseModule,
  CourseSettings,
  CourseStatus,
  Lesson,
  Prisma,
  Question,
  QuestionOption,
  QuizSettings,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindCoursesParams {
  status?: CourseStatus;
  instructorId?: string;
  categoryId?: string;
  search?: string;
  skip?: number;
  take?: number;
}

export type CourseWithDuration = Course & { totalDuration: number };

export type CourseWithCount = Course & {
  lessonsCount: number;
  enrollmentsCount: number;
  totalDuration: number;
};

export type CourseForDuplicate = Course & {
  modules: Array<
    CourseModule & {
      lessons: Array<
        Lesson & {
          quizSettings: QuizSettings | null;
          questions: Array<Question & { options: QuestionOption[] }>;
          assignmentSettings: AssignmentSettings | null;
        }
      >;
    }
  >;
};

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: FindCoursesParams): Promise<[CourseWithDuration[], number]> {
    const where: Prisma.CourseWhereInput = {
      ...(params.status && { status: params.status }),
      ...(params.instructorId && { instructorId: params.instructorId }),
      ...(params.categoryId && { categoryId: params.categoryId }),
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);
    const durations = await Promise.all(
      courses.map((c) =>
        this.prisma.lesson
          .aggregate({ where: { module: { courseId: c.id } }, _sum: { duration: true } })
          .then((agg) => agg._sum.duration ?? 0),
      ),
    );
    return [courses.map((c, i) => ({ ...c, totalDuration: durations[i] ?? 0 })), total];
  }

  findTotalDuration(courseId: string): Promise<number> {
    return this.prisma.lesson
      .aggregate({ where: { module: { courseId } }, _sum: { duration: true } })
      .then((agg) => agg._sum.duration ?? 0);
  }

  findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { id } });
  }

  async findByIdWithCount(id: string): Promise<CourseWithCount | null> {
    const [course, lessonsCount, durationAgg] = await Promise.all([
      this.prisma.course.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      }),
      this.prisma.lesson.count({ where: { module: { courseId: id } } }),
      this.prisma.lesson.aggregate({
        where: { module: { courseId: id } },
        _sum: { duration: true },
      }),
    ]);
    if (!course) return null;
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      enrollmentType: course.enrollmentType,
      price: course.price,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      level: course.level,
      whatYouWillLearn: course.whatYouWillLearn,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      lessonsCount,
      enrollmentsCount: course._count.enrollments,
      totalDuration: durationAgg._sum.duration ?? 0,
    };
  }

  findBySlug(slug: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { slug } });
  }

  async findBySlugWithCount(slug: string): Promise<CourseWithCount | null> {
    const [course, lessonsCount, durationAgg] = await Promise.all([
      this.prisma.course.findUnique({
        where: { slug },
        include: { _count: { select: { enrollments: true } } },
      }),
      this.prisma.lesson.count({ where: { module: { course: { slug } } } }),
      this.prisma.lesson.aggregate({
        where: { module: { course: { slug } } },
        _sum: { duration: true },
      }),
    ]);
    if (!course) return null;
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      enrollmentType: course.enrollmentType,
      price: course.price,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      level: course.level,
      whatYouWillLearn: course.whatYouWillLearn,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      lessonsCount,
      enrollmentsCount: course._count.enrollments,
      totalDuration: durationAgg._sum.duration ?? 0,
    };
  }

  countNonCancelledEnrollments(courseId: string): Promise<number> {
    return this.prisma.enrollment.count({
      where: { courseId, status: { not: 'CANCELLED' } },
    });
  }

  countLessons(courseId: string): Promise<number> {
    return this.prisma.lesson.count({ where: { module: { courseId } } });
  }

  /** Fetches a course with all nested modules, lessons, quiz settings, questions, and assignment settings needed for duplication. */
  findByIdForDuplicate(id: string): Promise<CourseForDuplicate | null> {
    return this.prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                quizSettings: true,
                questions: {
                  orderBy: { order: 'asc' },
                  include: { options: { orderBy: { order: 'asc' } } },
                },
                assignmentSettings: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Deep-copies a course (modules → lessons → quiz + assignment settings) inside a single
   * Prisma interactive transaction. rubricId and groupId are never copied.
   * See MISTAKES.md [014] — duplication must preserve instructorId from the requesting user.
   */
  async duplicateCourse(
    source: CourseForDuplicate,
    overrides: { title: string; slug: string; instructorId: string },
  ): Promise<Course> {
    return this.prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          title: overrides.title,
          slug: overrides.slug,
          description: source.description,
          coverUrl: source.coverUrl,
          price: source.price,
          status: 'DRAFT',
          instructorId: overrides.instructorId,
          ...(source.categoryId && { categoryId: source.categoryId }),
        },
      });

      for (const mod of source.modules) {
        const newMod = await tx.courseModule.create({
          data: {
            courseId: newCourse.id,
            title: mod.title,
            description: mod.description,
            order: mod.order,
            unlockAfterDays: mod.unlockAfterDays,
            isPublished: false,
          },
        });

        for (const lesson of mod.lessons) {
          const newLesson = await tx.lesson.create({
            data: {
              moduleId: newMod.id,
              title: lesson.title,
              order: lesson.order,
              type: lesson.type,
              content: lesson.content,
              videoUrl: lesson.videoUrl,
              duration: lesson.duration,
              isPreview: lesson.isPreview,
              isPublished: false,
              // rubricId not copied — rubrics are course-specific
            },
          });

          if (lesson.quizSettings) {
            await tx.quizSettings.create({
              data: {
                lessonId: newLesson.id,
                maxAttempts: lesson.quizSettings.maxAttempts,
                passingScore: lesson.quizSettings.passingScore,
                blocksProgress: lesson.quizSettings.blocksProgress,
                shuffleQuestions: lesson.quizSettings.shuffleQuestions,
              },
            });

            for (const q of lesson.questions) {
              const newQ = await tx.question.create({
                data: {
                  lessonId: newLesson.id,
                  text: q.text,
                  type: q.type,
                  order: q.order,
                  points: q.points,
                },
              });

              if (q.options.length > 0) {
                await tx.questionOption.createMany({
                  data: q.options.map((opt) => ({
                    questionId: newQ.id,
                    text: opt.text,
                    order: opt.order,
                    isCorrect: opt.isCorrect,
                  })),
                });
              }
            }
          }

          if (lesson.assignmentSettings) {
            await tx.assignmentSettings.create({
              data: {
                lessonId: newLesson.id,
                gradingType: lesson.assignmentSettings.gradingType,
                maxScore: lesson.assignmentSettings.maxScore,
                passingScore: lesson.assignmentSettings.passingScore,
                dueDate: lesson.assignmentSettings.dueDate,
                allowLateSubmission: lesson.assignmentSettings.allowLateSubmission,
                isGroupAssignment: lesson.assignmentSettings.isGroupAssignment,
                maxAttempts: lesson.assignmentSettings.maxAttempts,
                // groupId not copied — groups belong to the source course
              },
            });
          }
        }
      }

      return newCourse;
    });
  }

  upsertSettings(
    courseId: string,
    data: Prisma.CourseSettingsUpdateInput,
  ): Promise<CourseSettings> {
    return this.prisma.courseSettings.upsert({
      where: { courseId },
      create: { courseId, ...data } as Prisma.CourseSettingsCreateInput,
      update: data,
    });
  }

  create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }
}
