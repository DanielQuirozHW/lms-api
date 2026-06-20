import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus, EnrollmentType } from '@prisma/client';

export class UserEnrollmentItemDto {
  @ApiProperty()
  enrollmentId!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  courseTitle!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  coverUrl!: string | null;

  @ApiProperty({ enum: EnrollmentType })
  enrollmentType!: EnrollmentType;

  @ApiProperty({ enum: EnrollmentStatus })
  status!: EnrollmentStatus;

  @ApiProperty({ example: 66.7 })
  progressPercentage!: number;

  @ApiProperty({ example: 8 })
  completedLessons!: number;

  @ApiProperty({ example: 12 })
  totalLessons!: number;

  @ApiProperty({ type: String, nullable: true, example: 'Programación' })
  categoryName!: string | null;

  @ApiProperty()
  enrolledAt!: Date;
}
