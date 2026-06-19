import { ApiProperty } from '@nestjs/swagger';

export class LastActiveLessonResponseDto {
  @ApiProperty() lessonId!: string;
  @ApiProperty() moduleId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() courseSlug!: string;
  @ApiProperty() lastWatchedAt!: Date;
}
