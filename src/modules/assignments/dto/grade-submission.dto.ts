import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GradeAnswerItemDto {
  @ApiProperty({ example: 'crit-uuid' }) @IsString() @MinLength(20) criterionId!: string;
  @ApiPropertyOptional({ example: 'level-uuid' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  levelId?: string;
  @ApiProperty({ example: 18 }) @IsNumber() @Min(0) pointsAwarded!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() feedback?: string;
}

export class GradeSubmissionDto {
  @ApiProperty({ example: 85 })
  @IsInt()
  @Min(0)
  grade!: number;

  @ApiPropertyOptional({ example: 'Great work!' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({
    type: [GradeAnswerItemDto],
    description: 'Rubric answers — required when the lesson has a rubricId',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerItemDto)
  rubricAnswers?: GradeAnswerItemDto[];
}
