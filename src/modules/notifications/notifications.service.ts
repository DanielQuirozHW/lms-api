import { Injectable, NotFoundException } from '@nestjs/common';
import { type Notification, type NotificationSettings, NotificationType } from '@prisma/client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { NotificationQueryDto } from './dto/notification-query.dto';
import type { NotificationResponseDto } from './dto/notification-response.dto';
import type { UnreadCountDto } from './dto/unread-count.dto';
import { NotificationsRepository } from './notifications.repository';

type SettingsFlag = Extract<
  keyof NotificationSettings,
  'emailOnEnrollment' | 'emailOnNewLesson' | 'emailOnForumReply' | 'emailOnAssignmentGraded'
>;

const SETTINGS_FLAG: Partial<Record<NotificationType, SettingsFlag>> = {
  [NotificationType.ENROLLMENT]: 'emailOnEnrollment',
  [NotificationType.NEW_LESSON]: 'emailOnNewLesson',
  [NotificationType.FORUM_REPLY]: 'emailOnForumReply',
  [NotificationType.ASSIGNMENT_GRADED]: 'emailOnAssignmentGraded',
};

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<PaginatedResult<NotificationResponseDto>> {
    const [notifications, total] = await this.notificationsRepository.findMany(
      userId,
      query,
      query.isRead,
    );
    return paginate(
      notifications.map((n) => this.map(n)),
      total,
      query,
    );
  }

  async getUnreadCount(userId: string): Promise<UnreadCountDto> {
    const count = await this.notificationsRepository.countUnread(userId);
    return { count };
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.findByIdAndUserId(id, userId);
    if (!notification) throw new NotFoundException('Notification not found');
    const updated = await this.notificationsRepository.markRead(id);
    return this.map(updated);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.markAllRead(userId);
  }

  async delete(userId: string, id: string): Promise<void> {
    const notification = await this.notificationsRepository.findByIdAndUserId(id, userId);
    if (!notification) throw new NotFoundException('Notification not found');
    await this.notificationsRepository.delete(id);
  }

  /** Creates a notification for userId if the user's settings permit it. */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    referenceId?: string,
    referenceType?: string,
  ): Promise<void> {
    const flag = SETTINGS_FLAG[type];
    if (flag) {
      const settings = await this.notificationsRepository.getOrCreateSettings(userId);
      if (!settings[flag]) return;
    }
    await this.notificationsRepository.create({
      userId,
      type,
      title,
      body,
      referenceId,
      referenceType,
    });
  }

  private map(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      referenceId: notification.referenceId,
      referenceType: notification.referenceType,
      createdAt: notification.createdAt,
    };
  }
}
