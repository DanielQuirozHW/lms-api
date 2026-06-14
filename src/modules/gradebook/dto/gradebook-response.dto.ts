import { ApiProperty } from '@nestjs/swagger';

export class GradebookItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  lessonId!: string;

  @ApiProperty({ type: Number, nullable: true })
  weight!: number | null;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  isExtraCredit!: boolean;
}

export class GradebookCategoryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  weight!: number;

  @ApiProperty()
  order!: number;

  @ApiProperty({ type: [GradebookItemResponseDto] })
  items!: GradebookItemResponseDto[];
}

export class GradebookResponseDto {
  @ApiProperty()
  courseId!: string;

  @ApiProperty({ type: [GradebookCategoryResponseDto] })
  categories!: GradebookCategoryResponseDto[];

  @ApiProperty({ description: 'Total weight of all categories (should sum to 100)' })
  totalWeight!: number;
}

export class ItemGradeDto {
  @ApiProperty()
  itemId!: string;

  @ApiProperty()
  lessonId!: string;

  @ApiProperty({ type: Number, nullable: true })
  rawScore!: number | null;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Score as percentage 0-100' })
  percentageScore!: number | null;

  @ApiProperty()
  isExtraCredit!: boolean;
}

export class CategoryGradeDto {
  @ApiProperty()
  categoryId!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty()
  categoryWeight!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Weighted score for this category 0-100',
  })
  categoryScore!: number | null;

  @ApiProperty({ type: [ItemGradeDto] })
  items!: ItemGradeDto[];
}

export class StudentGradeResponseDto {
  @ApiProperty()
  enrollmentId!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty({ type: Number, nullable: true, description: 'Calculated final grade 0-100' })
  finalGrade!: number | null;

  @ApiProperty({ type: [CategoryGradeDto] })
  categories!: CategoryGradeDto[];
}
