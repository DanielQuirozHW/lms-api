import { ApiProperty } from '@nestjs/swagger';
import { MessageResponseDto } from './message-response.dto';

export class InboxItemDto {
  @ApiProperty({ example: 'user-uuid', description: 'ID of the conversation partner' })
  partnerId!: string;

  @ApiProperty({
    type: () => MessageResponseDto,
    description: 'Most recent message in the conversation',
  })
  lastMessage!: MessageResponseDto;

  @ApiProperty({ example: 3, description: 'Number of unread messages from this partner' })
  unreadCount!: number;
}
