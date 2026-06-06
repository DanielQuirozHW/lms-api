import { MinLength, IsString, MaxLength } from 'class-validator';

export class SendMessageWsDto {
  @IsString()
  @MinLength(20)
  receiverId!: string;

  @IsString()
  @MaxLength(4000)
  content!: string;
}
