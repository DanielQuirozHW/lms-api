import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty({ example: 'How do I implement authentication?', minLength: 5 })
  @IsString()
  @MinLength(5)
  title!: string;

  @ApiPropertyOptional({ example: 'course-uuid', description: 'Scope thread to a course forum' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  courseId?: string;
}
