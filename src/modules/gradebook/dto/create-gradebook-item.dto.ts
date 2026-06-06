import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MinLength, IsString, IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateGradebookItemDto {
  @ApiProperty({ description: 'ID of the lesson to link' })
  @IsString()
  @MinLength(20)
  lessonId!: string;

  @ApiProperty({ description: 'Category to put this item in' })
  @IsString()
  @MinLength(20)
  categoryId!: string;

  @ApiPropertyOptional({ description: 'Weight within category (null = equal weight)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ description: 'Maximum possible score' })
  @IsNumber()
  @Min(0)
  maxScore!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isExtraCredit?: boolean;
}
