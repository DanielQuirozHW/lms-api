import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Introduction to Variables', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ enum: LessonType, example: LessonType.VIDEO })
  @IsEnum(LessonType)
  type!: LessonType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Position in module. Auto-assigned (last + 1) if omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({ example: 'In this lesson we explore variable scoping...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/video.mp4',
    description: 'Required when type is VIDEO',
  })
  @ValidateIf((o: CreateLessonDto) => o.type === LessonType.VIDEO)
  @IsUrl()
  videoUrl?: string;

  @ApiPropertyOptional({ example: 480, description: 'Duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'When true, visible to non-enrolled users as a free preview',
  })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}
