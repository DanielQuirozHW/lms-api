import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadCourseCoverDto {
  @ApiProperty({ example: 'course-uuid' })
  @IsUUID()
  courseId!: string;
}
