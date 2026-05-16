import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { CourseStatus } from '@prisma/client';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
