import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionType } from '@prisma/client';

export class QuizSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiPropertyOptional({ nullable: true }) maxAttempts!: number | null;
  @ApiPropertyOptional({ nullable: true }) passingScore!: number | null;
  @ApiProperty() blocksProgress!: boolean;
  @ApiProperty() shuffleQuestions!: boolean;
}

export class QuestionOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional({ nullable: true }) isCorrect?: boolean;
}

export class QuestionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() text!: string;
  @ApiProperty({ enum: QuestionType }) type!: QuestionType;
  @ApiProperty() order!: number;
  @ApiProperty() points!: number;
  @ApiProperty({ type: [QuestionOptionResponseDto] }) options!: QuestionOptionResponseDto[];
}

export class AttemptSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() enrollmentId!: string;
  @ApiProperty() attemptNumber!: number;
  @ApiPropertyOptional({ nullable: true }) score!: number | null;
  @ApiProperty() startedAt!: Date;
  @ApiPropertyOptional({ nullable: true }) completedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) passed!: boolean | null;
}

export class AttemptAnswerDto {
  @ApiProperty() id!: string;
  @ApiProperty() questionId!: string;
  @ApiPropertyOptional({ nullable: true }) selectedOptionId!: string | null;
  @ApiPropertyOptional({ nullable: true }) textAnswer!: string | null;
  @ApiPropertyOptional({ nullable: true }) isCorrect!: boolean | null;
}

export class AttemptResultDto extends AttemptSummaryDto {
  @ApiProperty({ type: [AttemptAnswerDto] }) answers!: AttemptAnswerDto[];
}
