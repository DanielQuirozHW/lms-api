import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'course-uuid', description: 'ID of the course to enroll in' })
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional({
    example: 'PROMO2026',
    description: 'Enrollment code — required for CODE-type courses',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;
}
