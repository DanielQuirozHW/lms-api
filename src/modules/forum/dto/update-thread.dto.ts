import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateThreadDto {
  @ApiProperty({ example: 'Updated thread title', minLength: 5 })
  @IsString()
  @MinLength(5)
  title!: string;
}
