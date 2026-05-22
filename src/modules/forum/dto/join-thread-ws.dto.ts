import { IsUUID } from 'class-validator';

export class JoinThreadWsDto {
  @IsUUID()
  threadId!: string;
}
