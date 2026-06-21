import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CourseSettings, Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { slugify } from '../../common/utils/slug.util';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { CourseQueryDto } from './dto/course-query.dto';
import type { CourseDetailResponseDto, CourseResponseDto } from './dto/course-response.dto';
import type { CourseSettingsResponseDto } from './dto/course-settings-response.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import type { UpdateCourseSettingsDto } from './dto/update-course-settings.dto';
import {
  type CourseWithCount,
  type CourseWithDuration,
  CoursesRepository,
} from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  /** Creates a new course as DRAFT. Slug is auto-generated from title; P2002 on duplicate slug → 409. */
  async create(instructorId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.create({
      title: dto.title,
      slug: slugify(dto.title),
      description: dto.description,
      coverUrl: dto.coverUrl,
      price: dto.price ?? null,
      instructor: { connect: { id: instructorId } },
      ...(dto.categoryId && { category: { connect: { id: dto.categoryId } } }),
      ...(dto.level !== undefined && { level: dto.level }),
      whatYouWillLearn: dto.whatYouWillLearn ?? [],
      tags: dto.tags ?? [],
    });
    return this.map({ ...course, totalDuration: 0 });
  }

  /** Returns a paginated list of courses filtered by status (defaults to PUBLISHED when omitted). */
  async findAll(query: CourseQueryDto): Promise<PaginatedResult<CourseResponseDto>> {
    const [courses, total] = await this.coursesRepository.findMany({
      status: query.status ?? 'PUBLISHED',
      categoryId: query.categoryId,
      search: query.search,
      tags: query.tags,
      skip: query.skip,
      take: query.limit ?? 20,
    });
    return paginate(
      courses.map((c) => this.map(c)),
      total,
      query,
    );
  }

  /** Returns course detail including lessons and enrollment counts. Accepts either a CUID id or a slug. Non-PUBLISHED courses return 404 unless the caller is the owner or an admin. */
  async findOne(id: string, user?: AuthenticatedUser): Promise<CourseDetailResponseDto> {
    const course =
      (await this.coursesRepository.findByIdWithCount(id)) ??
      (await this.coursesRepository.findBySlugWithCount(id));
    if (!course) throw new NotFoundException('Course not found');

    const canViewNonPublished =
      user && (user.roles.includes(UserRole.ADMIN) || user.id === course.instructorId);
    if (course.status !== 'PUBLISHED' && !canViewNonPublished) {
      throw new NotFoundException('Course not found');
    }

    return this.mapDetail(course);
  }

  /** Returns all courses belonging to the given instructor, regardless of status. */
  async findMyCourses(
    instructorId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    const [courses, total] = await this.coursesRepository.findMany({
      instructorId,
      skip: pagination.skip,
      take: pagination.limit ?? 20,
    });
    return paginate(
      courses.map((c) => this.map(c)),
      total,
      pagination,
    );
  }

  /** Updates course fields. Re-generates slug when title is changed. */
  async update(courseId: string, dto: UpdateCourseDto): Promise<CourseResponseDto> {
    const data: Prisma.CourseUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title, slug: slugify(dto.title) }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.level !== undefined && { level: dto.level }),
      ...(dto.whatYouWillLearn !== undefined && { whatYouWillLearn: dto.whatYouWillLearn }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
    };
    const [course, totalDuration] = await Promise.all([
      this.coursesRepository.update(courseId, data),
      this.coursesRepository.findTotalDuration(courseId),
    ]);
    return this.map({ ...course, totalDuration });
  }

  /** Transitions the course to PUBLISHED status. Throws 404 if not found, 400 if no lessons. */
  async publish(courseId: string): Promise<CourseResponseDto> {
    const existing = await this.coursesRepository.findById(courseId);
    if (!existing) throw new NotFoundException('Course not found');
    const lessonCount = await this.coursesRepository.countLessons(courseId);
    if (lessonCount === 0) throw new BadRequestException('Cannot publish a course with no lessons');
    const [course, totalDuration] = await Promise.all([
      this.coursesRepository.update(courseId, { status: 'PUBLISHED' }),
      this.coursesRepository.findTotalDuration(courseId),
    ]);
    return this.map({ ...course, totalDuration });
  }

  /** Transitions the course to ARCHIVED status. */
  async archive(courseId: string): Promise<CourseResponseDto> {
    const [course, totalDuration] = await Promise.all([
      this.coursesRepository.update(courseId, { status: 'ARCHIVED' }),
      this.coursesRepository.findTotalDuration(courseId),
    ]);
    return this.map({ ...course, totalDuration });
  }

  /**
   * Deep-copies a course as a new DRAFT owned by the requesting instructor.
   * Title is prefixed with "Copia de ". Slug uniqueness is ensured server-side.
   * Copies modules, lessons, quiz settings + questions, and assignment settings.
   * Does NOT copy enrollments, progress, ratings, announcements, rubric links, or group IDs.
   */
  async duplicate(courseId: string, instructorId: string): Promise<CourseResponseDto> {
    const source = await this.coursesRepository.findByIdForDuplicate(courseId);
    if (!source) throw new NotFoundException('Course not found');

    const baseTitle = `Copia de ${source.title}`;
    const baseSlug = slugify(baseTitle);
    const slug = await this.generateUniqueSlug(baseSlug);

    const newCourse = await this.coursesRepository.duplicateCourse(source, {
      title: baseTitle,
      slug,
      instructorId,
    });
    const totalDuration = await this.coursesRepository.findTotalDuration(newCourse.id);
    return this.map({ ...newCourse, totalDuration });
  }

  /** Updates (or creates) the CourseSettings record. Ownership is enforced by CourseOwnerGuard upstream. */
  async updateSettings(
    courseId: string,
    dto: UpdateCourseSettingsDto,
  ): Promise<CourseSettingsResponseDto> {
    const data: Prisma.CourseSettingsUpdateInput = {
      ...(dto.enrollmentStartDate !== undefined && {
        enrollmentStartDate: dto.enrollmentStartDate ? new Date(dto.enrollmentStartDate) : null,
      }),
      ...(dto.enrollmentEndDate !== undefined && {
        enrollmentEndDate: dto.enrollmentEndDate ? new Date(dto.enrollmentEndDate) : null,
      }),
      ...(dto.courseStartDate !== undefined && {
        courseStartDate: dto.courseStartDate ? new Date(dto.courseStartDate) : null,
      }),
      ...(dto.hasModules !== undefined && { hasModules: dto.hasModules }),
      ...(dto.forumEnabled !== undefined && { forumEnabled: dto.forumEnabled }),
      ...(dto.forumPublic !== undefined && { forumPublic: dto.forumPublic }),
      ...(dto.certificateEnabled !== undefined && { certificateEnabled: dto.certificateEnabled }),
      ...(dto.ratingEnabled !== undefined && { ratingEnabled: dto.ratingEnabled }),
      ...(dto.ratingScale !== undefined && { ratingScale: dto.ratingScale }),
      ...(dto.maxEnrollments !== undefined && { maxEnrollments: dto.maxEnrollments }),
      ...(dto.isSequential !== undefined && { isSequential: dto.isSequential }),
    };
    const settings = await this.coursesRepository.upsertSettings(courseId, data);
    return this.mapSettings(settings);
  }

  /** Deletes the course. Throws 409 if the course has any non-cancelled enrollments (ACTIVE or COMPLETED). */
  async remove(courseId: string): Promise<void> {
    const enrollmentCount = await this.coursesRepository.countNonCancelledEnrollments(courseId);
    if (enrollmentCount > 0) {
      throw new ConflictException('Cannot delete a course with active or completed enrollments');
    }
    await this.coursesRepository.delete(courseId);
  }

  private async generateUniqueSlug(base: string): Promise<string> {
    if (!(await this.coursesRepository.findBySlug(base))) return base;
    const copy = `${base}-copy`;
    if (!(await this.coursesRepository.findBySlug(copy))) return copy;
    for (let i = 2; ; i++) {
      const candidate = `${base}-${String(i)}`;
      if (!(await this.coursesRepository.findBySlug(candidate))) return candidate;
    }
  }

  private map(course: CourseWithDuration): CourseResponseDto {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      enrollmentType: course.enrollmentType,
      price: course.price !== null ? Number(course.price) : null,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      level: course.level,
      whatYouWillLearn: course.whatYouWillLearn,
      tags: course.tags,
      totalDuration: course.totalDuration,
      enrollmentPeriodStart: null,
      enrollmentPeriodEnd: null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }

  private mapSettings(s: CourseSettings): CourseSettingsResponseDto {
    return {
      id: s.id,
      courseId: s.courseId,
      enrollmentStartDate: s.enrollmentStartDate,
      enrollmentEndDate: s.enrollmentEndDate,
      courseStartDate: s.courseStartDate,
      hasModules: s.hasModules,
      forumEnabled: s.forumEnabled,
      forumPublic: s.forumPublic,
      certificateEnabled: s.certificateEnabled,
      ratingEnabled: s.ratingEnabled,
      ratingScale: s.ratingScale,
      maxEnrollments: s.maxEnrollments,
      isSequential: s.isSequential,
    };
  }

  private mapDetail(course: CourseWithCount): CourseDetailResponseDto {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      enrollmentType: course.enrollmentType,
      price: course.price !== null ? Number(course.price) : null,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      level: course.level,
      whatYouWillLearn: course.whatYouWillLearn,
      tags: course.tags,
      enrollmentPeriodStart: null,
      enrollmentPeriodEnd: null,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      lessonsCount: course.lessonsCount,
      enrollmentsCount: course.enrollmentsCount,
      totalDuration: course.totalDuration,
    };
  }
}
