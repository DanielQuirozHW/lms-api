import { IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageWsDto {
  @IsUUID()
  receiverId!: string;

  @IsString()
  @MaxLength(4000)
  content!: string;
}
