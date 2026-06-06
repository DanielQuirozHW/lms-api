import { MinLength, IsString } from 'class-validator';

export class MarkReadWsDto {
  @IsString()
  @MinLength(20)
  senderId!: string;
}
