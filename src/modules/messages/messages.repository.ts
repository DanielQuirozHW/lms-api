import { Injectable } from '@nestjs/common';
import type { Message } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversation(userId1: string, userId2: string, take = 50): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  findInbox(userId: string, take = 50): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  create(data: { senderId: string; receiverId: string; content: string }): Promise<Message> {
    return this.prisma.message.create({ data });
  }

  markAsRead(id: string): Promise<Message> {
    return this.prisma.message.update({ where: { id }, data: { readAt: new Date() } });
  }
}
