import { Injectable } from '@nestjs/common';
import type { Message } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationDto } from '../../common/dto/pagination.dto';

export type InboxRawRow = {
  partner_id: string;
  msg_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read_at: Date | null;
  created_at: Date;
  unread_count: bigint;
};

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInbox(userId: string, pagination: PaginationDto): Promise<[InboxRawRow[], number]> {
    const skip = pagination.skip;
    const take = pagination.limit ?? 20;

    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<InboxRawRow[]>`
        WITH conversations AS (
          SELECT DISTINCT ON (
            CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END
          )
            CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END AS partner_id,
            id AS msg_id,
            sender_id,
            receiver_id,
            content,
            read_at,
            created_at
          FROM messages
          WHERE sender_id = ${userId} OR receiver_id = ${userId}
          ORDER BY
            CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END,
            created_at DESC
        ),
        unread_counts AS (
          SELECT sender_id AS partner_id, COUNT(*)::bigint AS unread_count
          FROM messages
          WHERE receiver_id = ${userId} AND read_at IS NULL
          GROUP BY sender_id
        )
        SELECT
          c.partner_id,
          c.msg_id,
          c.sender_id,
          c.receiver_id,
          c.content,
          c.read_at,
          c.created_at,
          COALESCE(u.unread_count, 0)::bigint AS unread_count
        FROM conversations c
        LEFT JOIN unread_counts u ON u.partner_id = c.partner_id
        ORDER BY c.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(
          DISTINCT CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END
        )::bigint AS count
        FROM messages
        WHERE sender_id = ${userId} OR receiver_id = ${userId}
      `,
    ]);

    const total = Number(countResult[0].count);
    return [rows, total];
  }

  async findConversation(
    userId1: string,
    userId2: string,
    pagination: PaginationDto,
  ): Promise<[Message[], number]> {
    const where: Prisma.MessageWhereInput = {
      OR: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
      }),
      this.prisma.message.count({ where }),
    ]);
    return [data, total];
  }

  create(data: { senderId: string; receiverId: string; content: string }): Promise<Message> {
    return this.prisma.message.create({ data });
  }

  async markConversationRead(receiverId: string, senderId: string): Promise<void> {
    await this.prisma.message.updateMany({
      where: { receiverId, senderId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
