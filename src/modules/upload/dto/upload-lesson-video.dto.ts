import { ApiProperty } from '@nestjs/swagger';
import { MinLength, IsString, IsIn } from 'class-validator';

export class UploadLessonVideoDto {
  @ApiProperty({ example: 'lesson-uuid' })
  @IsString()
  @MinLength(20)
  lessonId!: string;

  @ApiProperty({ example: 'video/mp4', enum: ['video/mp4', 'video/webm'] })
  @IsIn(['video/mp4', 'video/webm'])
  contentType!: string;
}
