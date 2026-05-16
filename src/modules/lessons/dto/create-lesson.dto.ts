import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from 'class-validator';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsInt()
  @Min(1)
  order!: number;

  @IsEnum(LessonType)
  type!: LessonType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}
