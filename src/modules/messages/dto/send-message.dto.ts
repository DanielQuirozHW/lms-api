import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, how are you?', minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;
}
