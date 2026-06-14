import { ApiProperty } from '@nestjs/swagger';
import { GradingType } from '@prisma/client';

export class AssignmentSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty({ enum: GradingType }) gradingType!: GradingType;
  @ApiProperty() maxScore!: number;
  @ApiProperty({ type: Number, nullable: true }) passingScore!: number | null;
  @ApiProperty({ type: Date, nullable: true }) dueDate!: Date | null;
  @ApiProperty() allowLateSubmission!: boolean;
  @ApiProperty() isGroupAssignment!: boolean;
  @ApiProperty({ type: String, nullable: true }) groupId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) maxAttempts!: number | null;
}

export class SubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() content!: string;
  @ApiProperty({ type: String, nullable: true }) fileUrl!: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiProperty() attemptNumber!: number;
  @ApiProperty({ type: Number, nullable: true }) grade!: number | null;
  @ApiProperty({ type: String, nullable: true }) feedback!: string | null;
  @ApiProperty({ type: String, nullable: true }) gradedById!: string | null;
  @ApiProperty({ type: Date, nullable: true }) gradedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) groupId!: string | null;
}
