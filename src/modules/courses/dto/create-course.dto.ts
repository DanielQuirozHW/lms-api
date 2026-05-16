import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Introduction to TypeScript', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'Learn TypeScript from scratch' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ example: 29.99, description: 'Price in USD, omit for free course' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}
