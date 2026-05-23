import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateGradebookItemDto {
  @ApiProperty({ description: 'ID of the lesson to link' })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ description: 'Category to put this item in' })
  @IsUUID()
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
