import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 'clxyz123...', description: 'ID of the course to enroll in' })
  @IsString()
  @MinLength(20)
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
