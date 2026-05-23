import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateProgressDto {
  @ApiPropertyOptional({ example: 120, description: 'Total seconds watched so far' })
  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSeconds?: number;

  @ApiPropertyOptional({ example: true, description: 'Mark the lesson as completed' })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
