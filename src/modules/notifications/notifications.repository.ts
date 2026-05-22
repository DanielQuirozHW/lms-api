import { Injectable } from '@nestjs/common';
import { type Notification, type NotificationSettings, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    userId: string,
    pagination: PaginationDto,
    isRead?: boolean,
  ): Promise<[Notification[], number]> {
    const where = { userId, ...(isRead !== undefined && { isRead }) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit ?? 20,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return [data, total];
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  findByIdAndUserId(id: string, userId: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({ where: { id, userId } });
  }

  markRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notification.delete({ where: { id } });
  }

  create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    referenceId?: string;
    referenceType?: string;
  }): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async getOrCreateSettings(userId: string): Promise<NotificationSettings> {
    const existing = await this.prisma.notificationSettings.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.notificationSettings.create({ data: { userId } });
  }
}
