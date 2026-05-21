import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradingType, LessonType } from '@prisma/client';

export class LessonResourceDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'Course Slides' }) title!: string;
  @ApiProperty({ example: 'https://example.com/slides.pdf' }) url!: string;
  @ApiProperty({ example: 'pdf' }) type!: string;
  @ApiProperty() createdAt!: Date;
}

export class QuizSettingsDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiPropertyOptional({ example: 3, nullable: true }) maxAttempts!: number | null;
  @ApiPropertyOptional({ example: 70, nullable: true }) passingScore!: number | null;
  @ApiProperty({ example: false }) blocksProgress!: boolean;
  @ApiProperty({ example: false }) shuffleQuestions!: boolean;
}

export class AssignmentSettingsDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ enum: GradingType, example: GradingType.MANUAL }) gradingType!: GradingType;
  @ApiProperty({ example: 100 }) maxScore!: number;
  @ApiPropertyOptional({ example: 60, nullable: true }) passingScore!: number | null;
  @ApiPropertyOptional({ example: null, nullable: true }) dueDate!: Date | null;
  @ApiProperty({ example: false }) allowLateSubmission!: boolean;
}

export class LessonResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'module-uuid' }) moduleId!: string;
  @ApiProperty({ example: 'Introduction to Variables' }) title!: string;
  @ApiProperty({ example: 1 }) order!: number;
  @ApiProperty({ enum: LessonType, example: LessonType.VIDEO }) type!: LessonType;
  @ApiPropertyOptional({ example: 'In this lesson...', nullable: true }) content!: string | null;
  @ApiPropertyOptional({ example: 'https://cdn.example.com/video.mp4', nullable: true }) videoUrl!:
    | string
    | null;
  @ApiPropertyOptional({ example: 480, nullable: true, description: 'Duration in seconds' })
  duration!: number | null;
  @ApiProperty({ example: false }) isPreview!: boolean;
  @ApiProperty({ example: false }) isPublished!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class LessonDetailResponseDto extends LessonResponseDto {
  @ApiProperty({ type: [LessonResourceDto] })
  resources!: LessonResourceDto[];

  @ApiPropertyOptional({ type: QuizSettingsDto, nullable: true })
  quizSettings!: QuizSettingsDto | null;

  @ApiPropertyOptional({ type: AssignmentSettingsDto, nullable: true })
  assignmentSettings!: AssignmentSettingsDto | null;
}
