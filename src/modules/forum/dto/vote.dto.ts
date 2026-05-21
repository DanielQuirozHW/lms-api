import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class VoteDto {
  @ApiProperty({ enum: [1, -1], description: '1 for upvote, -1 for downvote' })
  @IsInt()
  @IsIn([1, -1])
  value!: number;
}
