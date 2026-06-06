import { MinLength, IsString } from 'class-validator';

export class JoinThreadWsDto {
  @IsString()
  @MinLength(20)
  threadId!: string;
}
