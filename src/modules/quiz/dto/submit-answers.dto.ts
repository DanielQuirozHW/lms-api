import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MinLength,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerItemDto {
  @ApiProperty({ format: 'uuid' }) @IsString() @MinLength(20) questionId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  selectedOptionId?: string;

  @ApiPropertyOptional({ maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  textAnswer?: string;
}

export class SubmitAnswersDto {
  @ApiProperty({ type: [SubmitAnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerItemDto)
  answers!: SubmitAnswerItemDto[];
}
