import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradingType } from '@prisma/client';

export class AssignmentSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty({ enum: GradingType }) gradingType!: GradingType;
  @ApiProperty() maxScore!: number;
  @ApiPropertyOptional() passingScore!: number | null;
  @ApiPropertyOptional() dueDate!: Date | null;
  @ApiProperty() allowLateSubmission!: boolean;
  @ApiProperty() isGroupAssignment!: boolean;
  @ApiPropertyOptional() groupId!: string | null;
  @ApiPropertyOptional() maxAttempts!: number | null;
}

export class SubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional() fileUrl!: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiProperty() attemptNumber!: number;
  @ApiPropertyOptional() grade!: number | null;
  @ApiPropertyOptional() feedback!: string | null;
  @ApiPropertyOptional() gradedById!: string | null;
  @ApiPropertyOptional() gradedAt!: Date | null;
  @ApiPropertyOptional() groupId!: string | null;
}
