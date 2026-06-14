import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionType } from '@prisma/client';

export class QuizSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty({ type: Number, nullable: true }) maxAttempts!: number | null;
  @ApiProperty({ type: Number, nullable: true }) passingScore!: number | null;
  @ApiProperty() blocksProgress!: boolean;
  @ApiProperty() shuffleQuestions!: boolean;
}

export class QuestionOptionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional({ type: Boolean, nullable: true }) isCorrect?: boolean;
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
  @ApiProperty({ type: Number, nullable: true }) score!: number | null;
  @ApiProperty() startedAt!: Date;
  @ApiProperty({ type: Date, nullable: true }) completedAt!: Date | null;
  @ApiProperty({ type: Boolean, nullable: true }) passed!: boolean | null;
}

export class AttemptAnswerDto {
  @ApiProperty() id!: string;
  @ApiProperty() questionId!: string;
  @ApiProperty({ type: String, nullable: true }) selectedOptionId!: string | null;
  @ApiProperty({ type: String, nullable: true }) textAnswer!: string | null;
  @ApiProperty({ type: Boolean, nullable: true }) isCorrect!: boolean | null;
}

export class AttemptResultDto extends AttemptSummaryDto {
  @ApiProperty({ type: [AttemptAnswerDto] }) answers!: AttemptAnswerDto[];
}
