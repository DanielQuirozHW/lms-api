import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() threadId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional({ nullable: true }) parentId!: string | null;
  @ApiProperty() isAcceptedAnswer!: boolean;
  @ApiProperty({ description: 'Sum of all vote values (+1 upvote, -1 downvote)' })
  voteScore!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
