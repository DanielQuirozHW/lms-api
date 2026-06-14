import { ApiProperty } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';

export class CreateBookmarkDto {
  @ApiProperty({ description: 'ID of the lesson to bookmark' })
  @IsString()
  @MinLength(20)
  lessonId!: string;
}

export class BookmarkResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lessonId!: string;

  @ApiProperty()
  lessonTitle!: string;

  @ApiProperty({ enum: LessonType })
  lessonType!: LessonType;

  @ApiProperty()
  moduleId!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  courseTitle!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class CheckBookmarkResponseDto {
  @ApiProperty()
  bookmarked!: boolean;
}
