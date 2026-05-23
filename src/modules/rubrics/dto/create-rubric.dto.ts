import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateRubricLevelDto {
  @ApiProperty({ description: 'Level title', example: 'Excellent' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Level description', example: 'Demonstrates full mastery' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Points awarded for this level', example: 10 })
  @IsInt()
  @Min(0)
  points!: number;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  @IsInt()
  @Min(1)
  order!: number;
}

export class CreateRubricCriterionDto {
  @ApiProperty({ description: 'Criterion title', example: 'Code Quality' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Criterion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Display order (1-based)', example: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiProperty({ description: 'Maximum points for this criterion', example: 20 })
  @IsInt()
  @Min(0)
  points!: number;

  @ApiProperty({ type: [CreateRubricLevelDto], description: 'Performance levels' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricLevelDto)
  levels!: CreateRubricLevelDto[];
}

export class CreateRubricDto {
  @ApiProperty({ description: 'Rubric title', example: 'Final Project Rubric' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ description: 'Rubric description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Total achievable points', example: 100 })
  @IsInt()
  @Min(1)
  totalPoints!: number;

  @ApiProperty({ type: [CreateRubricCriterionDto], description: 'Assessment criteria' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRubricCriterionDto)
  criteria!: CreateRubricCriterionDto[];
}
