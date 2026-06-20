import { ApiProperty } from '@nestjs/swagger';
import { CourseLevel, CourseStatus, EnrollmentType } from '@prisma/client';

export class CourseResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: 'Introduction to TypeScript' })
  title!: string;

  @ApiProperty({ example: 'introduction-to-typescript' })
  slug!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Learn TypeScript from scratch' })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'https://example.com/cover.jpg' })
  coverUrl!: string | null;

  @ApiProperty({ enum: CourseStatus, example: CourseStatus.DRAFT })
  status!: CourseStatus;

  @ApiProperty({ enum: EnrollmentType, example: EnrollmentType.FREE })
  enrollmentType!: EnrollmentType;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 29.99,
    description: 'Price in USD, null means free',
  })
  price!: number | null;

  @ApiProperty({ example: 'instructor-uuid' })
  instructorId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'category-uuid' })
  categoryId!: string | null;

  @ApiProperty({ enum: CourseLevel, example: CourseLevel.BEGINNER })
  level!: CourseLevel;

  @ApiProperty({
    type: [String],
    example: ['Understand TypeScript basics', 'Build typed interfaces'],
  })
  whatYouWillLearn!: string[];

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description: 'Enrollment open date (from CourseSettings)',
  })
  enrollmentPeriodStart!: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    example: null,
    description: 'Enrollment close date (from CourseSettings)',
  })
  enrollmentPeriodEnd!: Date | null;

  @ApiProperty({ example: 14400, description: 'Sum of all lesson durations in seconds' })
  totalDuration!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CourseDetailResponseDto extends CourseResponseDto {
  @ApiProperty({ example: 12 })
  lessonsCount!: number;

  @ApiProperty({ example: 340 })
  enrollmentsCount!: number;
}
