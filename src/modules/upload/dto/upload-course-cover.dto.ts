import { ApiProperty } from '@nestjs/swagger';
import { MinLength, IsString } from 'class-validator';

export class UploadCourseCoverDto {
  @ApiProperty({ example: 'course-uuid' })
  @IsString()
  @MinLength(20)
  courseId!: string;
}
