import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Message } from '@prisma/client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { ConversationResponseDto } from './dto/inbox-item.dto';
import type { MessageResponseDto } from './dto/message-response.dto';
import type { SendMessageDto } from './dto/send-message.dto';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async send(
    senderId: string,
    receiverId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot send a message to yourself');
    }
    const receiver = await this.messagesRepository.findUserById(receiverId);
    if (!receiver) throw new NotFoundException('Recipient user not found');
    const message = await this.messagesRepository.create({
      senderId,
      receiverId,
      content: dto.content,
    });
    return this.mapMessage(message);
  }

  async getInbox(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<ConversationResponseDto>> {
    const [rows, total] = await this.messagesRepository.findInbox(userId, pagination);
    const data: ConversationResponseDto[] = rows.map((row) => ({
      partnerId: row.partner_id,
      lastMessage: {
        id: row.msg_id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        content: row.content,
        readAt: row.read_at,
        createdAt: row.created_at,
      },
      unreadCount: Number(row.unread_count),
    }));
    return paginate(data, total, pagination);
  }

  async getConversation(
    userId: string,
    partnerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<MessageResponseDto>> {
    const [messages, total] = await this.messagesRepository.findConversation(
      userId,
      partnerId,
      pagination,
    );
    return paginate(
      messages.map((m) => this.mapMessage(m)),
      total,
      pagination,
    );
  }

  async markConversationRead(receiverId: string, senderId: string): Promise<void> {
    await this.messagesRepository.markConversationRead(receiverId, senderId);
  }

  private mapMessage(message: Message): MessageResponseDto {
    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }
}
