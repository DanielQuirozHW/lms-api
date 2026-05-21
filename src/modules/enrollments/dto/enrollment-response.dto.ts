import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';

export class ProgressSummaryDto {
  @ApiProperty({ example: 12, description: 'Total published lessons in the course' })
  totalLessons!: number;

  @ApiProperty({ example: 5, description: 'Lessons with a completedAt timestamp' })
  completedLessons!: number;

  @ApiProperty({ example: 41.7, description: 'Completed / total * 100, rounded to 1 decimal' })
  progressPercentage!: number;
}

export class EnrollmentResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'user-uuid' }) userId!: string;
  @ApiProperty({ example: 'course-uuid' }) courseId!: string;
  @ApiProperty({ enum: EnrollmentStatus, example: EnrollmentStatus.ACTIVE })
  status!: EnrollmentStatus;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
  @ApiProperty() enrolledAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class EnrollmentDetailResponseDto extends EnrollmentResponseDto {
  @ApiProperty({ type: ProgressSummaryDto })
  progress!: ProgressSummaryDto;
}
