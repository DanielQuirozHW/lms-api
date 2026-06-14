import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradingType } from '@prisma/client';

export class AssignmentSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty({ enum: GradingType }) gradingType!: GradingType;
  @ApiProperty() maxScore!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) passingScore!: number | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) dueDate!: Date | null;
  @ApiProperty() allowLateSubmission!: boolean;
  @ApiProperty() isGroupAssignment!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) groupId!: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) maxAttempts!: number | null;
}

export class SubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) fileUrl!: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiProperty() attemptNumber!: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) grade!: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) feedback!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) gradedById!: string | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) gradedAt!: Date | null;
  @ApiPropertyOptional({ type: String, nullable: true }) groupId!: string | null;
}
