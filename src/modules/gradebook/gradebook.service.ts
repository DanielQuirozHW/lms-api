import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GradebookCategory, GradebookItem } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import type { CreateGradebookCategoryDto } from './dto/create-gradebook-category.dto';
import type { CreateGradebookItemDto } from './dto/create-gradebook-item.dto';
import type { UpdateGradebookCategoryDto } from './dto/update-gradebook-category.dto';
import type {
  CategoryGradeDto,
  GradebookCategoryResponseDto,
  GradebookItemResponseDto,
  GradebookResponseDto,
  ItemGradeDto,
  StudentGradeResponseDto,
} from './dto/gradebook-response.dto';
import { type CategoryWithItems, GradebookRepository } from './gradebook.repository';

@Injectable()
export class GradebookService {
  constructor(
    private readonly gradebookRepository: GradebookRepository,
    private readonly coursesService: CoursesService,
  ) {}

  /** Returns the full gradebook structure for a course (categories + items). */
  async findStructure(courseId: string, user: AuthenticatedUser): Promise<GradebookResponseDto> {
    await this.coursesService.findOne(courseId, user);
    const categories = await this.gradebookRepository.findCategoriesWithItems(courseId);
    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    return {
      courseId,
      categories: categories.map((c) => this.mapCategory(c, c.items)),
      totalWeight,
    };
  }

  /** Creates a new gradebook category scoped to the given course. Instructor must own the course. */
  async createCategory(
    courseId: string,
    dto: CreateGradebookCategoryDto,
    user: AuthenticatedUser,
  ): Promise<GradebookCategoryResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);
    const category = await this.gradebookRepository.createCategory({
      name: dto.name,
      weight: dto.weight,
      order: dto.order,
      course: { connect: { id: courseId } },
    });
    return this.mapCategory(category, []);
  }

  /** Updates a gradebook category. Instructor must own the course. */
  async updateCategory(
    courseId: string,
    id: string,
    dto: UpdateGradebookCategoryDto,
    user: AuthenticatedUser,
  ): Promise<GradebookCategoryResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const existing = await this.gradebookRepository.findCategoryByIdAndCourse(id, courseId);
    if (!existing) throw new NotFoundException('Gradebook category not found');

    const updated = await this.gradebookRepository.updateCategory(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.weight !== undefined && { weight: dto.weight }),
      ...(dto.order !== undefined && { order: dto.order }),
    });
    return this.mapCategory(updated, []);
  }

  /** Deletes a gradebook category. Throws ConflictException if the category still has items. */
  async deleteCategory(courseId: string, id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const existing = await this.gradebookRepository.findCategoryByIdAndCourse(id, courseId);
    if (!existing) throw new NotFoundException('Gradebook category not found');
    if (existing._count.items > 0) {
      throw new ConflictException('Cannot delete category with items');
    }

    await this.gradebookRepository.deleteCategory(id);
  }

  /** Creates a gradebook item linking a lesson to a category. Instructor must own the course. */
  async createItem(
    courseId: string,
    dto: CreateGradebookItemDto,
    user: AuthenticatedUser,
  ): Promise<GradebookItemResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const category = await this.gradebookRepository.findCategoryByIdAndCourse(
      dto.categoryId,
      courseId,
    );
    if (!category) throw new NotFoundException('Gradebook category not found');

    const item = await this.gradebookRepository.createItem({
      weight: dto.weight ?? null,
      maxScore: dto.maxScore,
      isExtraCredit: dto.isExtraCredit ?? false,
      category: { connect: { id: dto.categoryId } },
      lesson: { connect: { id: dto.lessonId } },
    });
    return this.mapItem(item);
  }

  /** Deletes a gradebook item. Instructor must own the course. */
  async deleteItem(courseId: string, id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const item = await this.gradebookRepository.findItemByCategoryAndCourse(id, courseId);
    if (!item) throw new NotFoundException('Gradebook item not found');

    await this.gradebookRepository.deleteItem(id);
  }

  /** Returns the calculated grade for a student enrollment. Caller must be the enrolled student, or an instructor/admin. */
  async getStudentGrade(
    courseId: string,
    enrollmentId: string,
    user: AuthenticatedUser,
  ): Promise<StudentGradeResponseDto> {
    const enrollment = await this.gradebookRepository.findEnrollmentById(enrollmentId);
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.courseId !== courseId) throw new NotFoundException('Enrollment not found');

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    const isInstructor = user.roles.includes(UserRole.INSTRUCTOR);
    const isOwnEnrollment = enrollment.userId === user.id;

    if (!isOwnEnrollment && !isInstructor && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this grade');
    }

    const [categories, quizScores, submissionScores] = await Promise.all([
      this.gradebookRepository.findCategoriesWithItems(courseId),
      this.gradebookRepository.getQuizScores(enrollmentId),
      this.gradebookRepository.getSubmissionScores(enrollmentId),
    ]);

    const { categories: gradedCategories, finalGrade } = this.calculateStudentGrade(
      categories,
      quizScores,
      submissionScores,
    );

    return {
      enrollmentId,
      courseId,
      finalGrade,
      categories: gradedCategories,
    };
  }

  private calculateStudentGrade(
    categories: CategoryWithItems[],
    quizScores: Map<string, number>,
    submissionScores: Map<string, number>,
  ): { categories: CategoryGradeDto[]; finalGrade: number | null } {
    const gradedCategories: CategoryGradeDto[] = categories.map((category) => {
      const items: ItemGradeDto[] = category.items.map((item) => {
        const rawScore =
          quizScores.get(item.lessonId) ?? submissionScores.get(item.lessonId) ?? null;
        const percentageScore =
          rawScore !== null && item.maxScore > 0 ? (rawScore / item.maxScore) * 100 : null;
        return {
          itemId: item.id,
          lessonId: item.lessonId,
          rawScore,
          maxScore: item.maxScore,
          percentageScore,
          isExtraCredit: item.isExtraCredit,
        };
      });

      // Compute category score using only non-extra-credit items that have a score
      const scoredItems = items.filter((i) => !i.isExtraCredit && i.percentageScore !== null);
      let categoryScore: number | null = null;

      if (scoredItems.length > 0) {
        const hasWeights = category.items
          .filter((i) => !i.isExtraCredit)
          .some((i) => i.weight !== null);

        if (hasWeights) {
          let weightedSum = 0;
          let totalWeight = 0;
          for (const scored of scoredItems) {
            const itemWeight = category.items.find((i) => i.id === scored.itemId)?.weight ?? null;
            if (itemWeight !== null) {
              weightedSum += (scored.percentageScore as number) * itemWeight;
              totalWeight += itemWeight;
            }
          }
          categoryScore = totalWeight > 0 ? weightedSum / totalWeight : null;
        } else {
          const sum = scoredItems.reduce((acc, i) => acc + (i.percentageScore as number), 0);
          categoryScore = sum / scoredItems.length;
        }
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        categoryWeight: category.weight,
        categoryScore,
        items,
      };
    });

    const scoredCategories = gradedCategories.filter((c) => c.categoryScore !== null);
    let finalGrade: number | null = null;

    if (scoredCategories.length > 0) {
      finalGrade = scoredCategories.reduce(
        (sum, c) => sum + (c.categoryScore as number) * (c.categoryWeight / 100),
        0,
      );
    }

    return { categories: gradedCategories, finalGrade };
  }

  private mapCategory(
    cat: GradebookCategory,
    items: GradebookItem[],
  ): GradebookCategoryResponseDto {
    return {
      id: cat.id,
      courseId: cat.courseId,
      name: cat.name,
      weight: cat.weight,
      order: cat.order,
      items: items.map((i) => this.mapItem(i)),
    };
  }

  private mapItem(item: GradebookItem): GradebookItemResponseDto {
    return {
      id: item.id,
      categoryId: item.categoryId,
      lessonId: item.lessonId,
      weight: item.weight,
      maxScore: item.maxScore,
      isExtraCredit: item.isExtraCredit,
    };
  }

  private verifyOwnership(course: { instructorId: string }, user: AuthenticatedUser): void {
    if (user.roles.includes(UserRole.ADMIN)) return;
    if (course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }
  }
}
