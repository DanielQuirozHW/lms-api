import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated post content', minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;
}
