import { IsUUID } from 'class-validator';

export class MarkReadWsDto {
  @IsUUID()
  senderId!: string;
}
