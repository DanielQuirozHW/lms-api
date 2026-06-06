import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MinLength, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ example: 'course-uuid' })
  @IsString()
  @MinLength(20)
  courseId!: string;

  @ApiProperty({
    example: 4,
    description: 'Score (1–100; upper bound depends on course rating scale)',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  score!: number;

  @ApiPropertyOptional({ example: 'Great course!', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  review?: string;
}
