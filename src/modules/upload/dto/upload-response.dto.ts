import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ example: 'https://cdn.example.com/avatars/user-123/abc.jpg' })
  url!: string;
}

export class VideoUploadResponseDto {
  @ApiProperty({ example: 'https://r2.storage.com/lessons/course-id/lesson-id/abc.mp4?sig=...' })
  uploadUrl!: string;

  @ApiProperty({ example: 'lessons/course-id/lesson-id/abc.mp4' })
  key!: string;

  @ApiProperty({ example: 'https://cdn.example.com/lessons/course-id/lesson-id/abc.mp4' })
  publicUrl!: string;
}
