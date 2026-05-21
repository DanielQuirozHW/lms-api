import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'course-uuid', description: 'ID of the course to enroll in' })
  @IsUUID()
  courseId!: string;
}
