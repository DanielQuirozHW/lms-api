import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class InboxItemDto {
  @ApiProperty() partnerId!: string;
  @ApiProperty() lastMessage!: MessageResponseDto;
  @ApiProperty() unreadCount!: number;
}
