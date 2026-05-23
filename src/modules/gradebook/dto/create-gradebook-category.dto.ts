import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateGradebookCategoryDto {
  @ApiProperty({ example: 'Quizzes' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Weight as percentage 0-100', example: 30 })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order!: number;
}
