import { ApiProperty } from '@nestjs/swagger';

export class LastActiveLessonResponseDto {
  @ApiProperty({ example: 'lesson-uuid' }) lessonId!: string;
  @ApiProperty({ example: 'module-uuid' }) moduleId!: string;
  @ApiProperty({ example: 'course-uuid' }) courseId!: string;
  @ApiProperty({ example: 'introduction-to-typescript' }) courseSlug!: string;
  @ApiProperty() lastWatchedAt!: Date;
}
