import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';

export class LessonSummaryDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'Introduction to Variables' }) title!: string;
  @ApiProperty({ example: 1 }) order!: number;
  @ApiProperty({ enum: LessonType, example: LessonType.VIDEO }) type!: LessonType;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 300,
    description: 'Duration in seconds',
  })
  duration!: number | null;
  @ApiProperty({ example: false }) isPreview!: boolean;
  @ApiProperty({ example: true }) isPublished!: boolean;
}

export class ModuleResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'course-uuid' }) courseId!: string;
  @ApiProperty({ example: 'Getting Started' }) title!: string;
  @ApiPropertyOptional({
    type: String,
    example: 'An introduction to the fundamentals',
    nullable: true,
  })
  description!: string | null;
  @ApiProperty({ example: 1 }) order!: number;
  @ApiProperty({ example: false }) isPublished!: boolean;
  @ApiPropertyOptional({
    type: Number,
    example: 3,
    nullable: true,
    description: 'Days after enrollment before this module unlocks',
  })
  unlockAfterDays!: number | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ModuleDetailResponseDto extends ModuleResponseDto {
  @ApiProperty({ type: [LessonSummaryDto] })
  lessons!: LessonSummaryDto[];
}
