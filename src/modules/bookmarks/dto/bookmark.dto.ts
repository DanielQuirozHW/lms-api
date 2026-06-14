import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';

export class CreateBookmarkDto {
  @ApiProperty({ description: 'ID of the lesson to bookmark' })
  @IsString()
  @MinLength(20)
  lessonId!: string;
}

export class BookmarkLessonCourseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
}

export class BookmarkLessonDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: LessonType }) type!: LessonType;
  @ApiProperty({ description: "The lesson's parent course ID" }) courseId!: string;
  @ApiPropertyOptional({ type: BookmarkLessonCourseDto, nullable: true })
  course?: BookmarkLessonCourseDto | null;
}

export class BookmarkResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() lessonId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: BookmarkLessonDto }) lesson!: BookmarkLessonDto;
  @ApiProperty() createdAt!: Date;
}

export class CheckBookmarkResponseDto {
  @ApiProperty() isBookmarked!: boolean;
}
