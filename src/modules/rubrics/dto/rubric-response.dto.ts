import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RubricLevelResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  criterionId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  points!: number;

  @ApiProperty()
  order!: number;
}

export class RubricCriterionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  rubricId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  order!: number;

  @ApiProperty()
  points!: number;

  @ApiProperty({ type: [RubricLevelResponseDto] })
  levels!: RubricLevelResponseDto[];
}

export class RubricResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  totalPoints!: number;

  @ApiProperty({ type: [RubricCriterionResponseDto] })
  criteria!: RubricCriterionResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class RubricSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  totalPoints!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class RubricAssessmentAnswerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  assessmentId!: string;

  @ApiProperty()
  criterionId!: string;

  @ApiPropertyOptional({ nullable: true })
  levelId!: string | null;

  @ApiProperty()
  pointsAwarded!: number;

  @ApiPropertyOptional({ nullable: true })
  feedback!: string | null;
}

export class RubricAssessmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  rubricId!: string;

  @ApiProperty()
  submissionId!: string;

  @ApiProperty()
  assessorId!: string;

  @ApiProperty()
  totalScore!: number;

  @ApiPropertyOptional({ nullable: true })
  feedback!: string | null;

  @ApiProperty()
  assessedAt!: Date;

  @ApiProperty({ type: [RubricAssessmentAnswerResponseDto] })
  answers!: RubricAssessmentAnswerResponseDto[];
}
