import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

export class CreateOptionDto {
  @ApiProperty() @IsString() @MinLength(1) text!: string;
  @ApiProperty() @IsBoolean() isCorrect!: boolean;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) order!: number;
}

export class CreateQuestionDto {
  @ApiProperty() @IsString() @MinLength(1) text!: string;
  @ApiProperty({ enum: QuestionType }) @IsEnum(QuestionType) type!: QuestionType;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({ type: [CreateOptionDto], minItems: 2 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}
