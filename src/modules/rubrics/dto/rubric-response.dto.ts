import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RubricLevelResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  criterionId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
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

  @ApiPropertyOptional({ type: String, nullable: true })
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

  @ApiPropertyOptional({ type: String, nullable: true })
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

  @ApiPropertyOptional({ type: String, nullable: true })
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

  @ApiPropertyOptional({ type: String, nullable: true })
  levelId!: string | null;

  @ApiProperty({ description: 'Points awarded for this criterion' })
  score!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Assessor comment for this criterion',
  })
  comment!: string | null;
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

  @ApiProperty({ description: 'Sum of all answer scores' })
  score!: number;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Overall assessor feedback' })
  feedback!: string | null;

  @ApiProperty()
  assessedAt!: Date;

  @ApiProperty({ type: [RubricAssessmentAnswerResponseDto] })
  answers!: RubricAssessmentAnswerResponseDto[];
}
