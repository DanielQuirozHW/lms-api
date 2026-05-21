import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'Getting Started', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'An introduction to the course fundamentals' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Position within the course. Auto-assigned (last + 1) if omitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Days after enrollment before this module unlocks. Null means immediately available.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  unlockAfterDays?: number;
}
