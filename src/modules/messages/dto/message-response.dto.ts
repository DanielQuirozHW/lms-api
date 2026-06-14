import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() senderId!: string;
  @ApiProperty() receiverId!: string;
  @ApiProperty() content!: string;
  @ApiProperty({ type: Date, nullable: true }) readAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}
