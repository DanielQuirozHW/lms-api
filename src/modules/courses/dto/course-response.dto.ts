import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus } from '@prisma/client';

export class CourseResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: 'Introduction to TypeScript' })
  title!: string;

  @ApiProperty({ example: 'introduction-to-typescript' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Learn TypeScript from scratch' })
  description!: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  coverUrl!: string | null;

  @ApiProperty({ enum: CourseStatus, example: CourseStatus.DRAFT })
  status!: CourseStatus;

  @ApiPropertyOptional({ example: 29.99, description: 'Price in USD, null means free' })
  price!: number | null;

  @ApiProperty({ example: 'instructor-uuid' })
  instructorId!: string;

  @ApiPropertyOptional({ example: 'category-uuid' })
  categoryId!: string | null;

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
