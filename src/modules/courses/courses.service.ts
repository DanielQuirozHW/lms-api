import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Course, Prisma } from '@prisma/client';
import { slugify } from '../../common/utils/slug.util';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { CourseQueryDto } from './dto/course-query.dto';
import type { CourseDetailResponseDto, CourseResponseDto } from './dto/course-response.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import { type CourseWithCount, CoursesRepository } from './courses.repository';

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
    });
    return this.map(course);
  }

  /** Returns a paginated list of courses. Defaults to PUBLISHED when no status filter is provided. */
  async findAll(query: CourseQueryDto): Promise<PaginatedResult<CourseResponseDto>> {
    const [courses, total] = await this.coursesRepository.findMany({
      status: query.status ?? 'PUBLISHED',
      categoryId: query.categoryId,
      skip: query.skip,
      take: query.limit ?? 20,
    });
    return paginate(
      courses.map((c) => this.map(c)),
      total,
      query,
    );
  }

  /** Returns course detail including lessons and enrollment counts. */
  async findOne(id: string): Promise<CourseDetailResponseDto> {
    const course = await this.coursesRepository.findByIdWithCount(id);
    if (!course) throw new NotFoundException('Course not found');
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
    };
    const course = await this.coursesRepository.update(courseId, data);
    return this.map(course);
  }

  /** Transitions the course to PUBLISHED status. */
  async publish(courseId: string): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.update(courseId, { status: 'PUBLISHED' });
    return this.map(course);
  }

  /** Transitions the course to ARCHIVED status. */
  async archive(courseId: string): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.update(courseId, { status: 'ARCHIVED' });
    return this.map(course);
  }

  /** Deletes the course. Throws 409 if the course has active enrollments. */
  async remove(courseId: string): Promise<void> {
    const activeCount = await this.coursesRepository.countActiveEnrollments(courseId);
    if (activeCount > 0) {
      throw new ConflictException('Cannot delete a course with active enrollments');
    }
    await this.coursesRepository.delete(courseId);
  }

  private map(course: Course): CourseResponseDto {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      coverUrl: course.coverUrl,
      status: course.status,
      price: course.price !== null ? Number(course.price) : null,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
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
      price: course.price !== null ? Number(course.price) : null,
      instructorId: course.instructorId,
      categoryId: course.categoryId,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      lessonsCount: course._count.lessons,
      enrollmentsCount: course._count.enrollments,
    };
  }
}
