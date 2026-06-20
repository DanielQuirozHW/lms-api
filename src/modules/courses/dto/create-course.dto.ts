import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseLevel } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
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
  @IsString()
  @MinLength(20)
  categoryId?: string;

  @ApiPropertyOptional({ example: 29.99, description: 'Price in USD, omit for free course' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ enum: CourseLevel, example: CourseLevel.BEGINNER })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiPropertyOptional({
    type: [String],
    example: ['Understand TypeScript basics', 'Build typed interfaces'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whatYouWillLearn?: string[];
}
