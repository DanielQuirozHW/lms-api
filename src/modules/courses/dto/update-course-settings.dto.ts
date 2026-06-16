import { ApiPropertyOptional } from '@nestjs/swagger';
import { RatingScale } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateCourseSettingsDto {
  @ApiPropertyOptional({ description: 'When enrollment opens (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  enrollmentStartDate?: string;

  @ApiPropertyOptional({ description: 'When enrollment closes (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  enrollmentEndDate?: string;

  @ApiPropertyOptional({ description: 'When course content becomes available (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  courseStartDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasModules?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forumEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forumPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  certificateEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ratingEnabled?: boolean;

  @ApiPropertyOptional({ enum: RatingScale })
  @IsOptional()
  @IsEnum(RatingScale)
  ratingScale?: RatingScale;

  @ApiPropertyOptional({ description: 'Maximum number of active enrollments (null = unlimited)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => (value === null ? null : value))
  maxEnrollments?: number | null;

  @ApiPropertyOptional({ description: 'Require lessons to be completed in order' })
  @IsOptional()
  @IsBoolean()
  isSequential?: boolean;
}
