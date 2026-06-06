import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RubricAssessmentAnswerDto {
  @ApiProperty({ description: 'Criterion ID', example: 'crit-uuid' })
  @IsString()
  @MinLength(20)
  criterionId!: string;

  @ApiPropertyOptional({ description: 'Selected level ID', example: 'level-uuid' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  levelId?: string;

  @ApiProperty({ description: 'Points awarded for this criterion', example: 18 })
  @IsNumber()
  @Min(0)
  pointsAwarded!: number;

  @ApiPropertyOptional({ description: 'Per-criterion feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class CreateRubricAssessmentDto {
  @ApiPropertyOptional({ description: 'Overall assessment feedback' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiProperty({ type: [RubricAssessmentAnswerDto], description: 'Per-criterion answers' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricAssessmentAnswerDto)
  answers!: RubricAssessmentAnswerDto[];
}
