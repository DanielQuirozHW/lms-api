import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class UploadLessonVideoDto {
  @ApiProperty({ example: 'lesson-uuid' })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ example: 'video/mp4', enum: ['video/mp4', 'video/webm'] })
  @IsIn(['video/mp4', 'video/webm'])
  contentType!: string;
}
