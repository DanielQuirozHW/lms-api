import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Notification, type NotificationSettings, NotificationType } from '@prisma/client';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

const now = new Date('2026-01-01');

const mockNotification: Notification = {
  id: 'notif-1',
  userId: 'user-1',
  type: NotificationType.ENROLLMENT,
  title: 'Enrolled!',
  body: 'You enrolled in Course X',
  isRead: false,
  referenceId: 'course-1',
  referenceType: 'course',
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
};

const mockSettings: NotificationSettings = {
  id: 'settings-1',
  userId: 'user-1',
  emailOnEnrollment: true,
  emailOnNewLesson: true,
  emailOnForumReply: true,
  emailOnAssignmentGraded: true,
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
};

const pagination = {
  page: 1,
  limit: 20,
  get skip(): number {
    return 0;
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<
    Pick<
      NotificationsRepository,
      | 'findMany'
      | 'countUnread'
      | 'findByIdAndUserId'
      | 'markRead'
      | 'markAllRead'
      | 'delete'
      | 'create'
      | 'getOrCreateSettings'
    >
  >;

  beforeEach(async () => {
    repo = {
      findMany: jest.fn(),
      countUnread: jest.fn(),
      findByIdAndUserId: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      getOrCreateSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: NotificationsRepository, useValue: repo }],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      repo.findMany.mockResolvedValue([[mockNotification], 1]);

      const result = await service.getNotifications('user-1', { ...pagination });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('notif-1');
      expect(result.meta.total).toBe(1);
    });

    it('should filter by isRead when provided', async () => {
      repo.findMany.mockResolvedValue([[{ ...mockNotification, isRead: true }], 1]);

      const result = await service.getNotifications('user-1', { ...pagination, isRead: true });

      expect(repo.findMany).toHaveBeenCalledWith('user-1', expect.anything(), true);
      expect(result.data[0].isRead).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count', async () => {
      repo.countUnread.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      repo.countUnread.mockResolvedValue(0);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(0);
    });
  });

  describe('markRead', () => {
    it('should mark notification as read', async () => {
      const readNotif: Notification = { ...mockNotification, isRead: true };
      repo.findByIdAndUserId.mockResolvedValue(mockNotification);
      repo.markRead.mockResolvedValue(readNotif);

      const result = await service.markRead('user-1', 'notif-1');

      expect(repo.markRead).toHaveBeenCalledWith('notif-1');
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException when notification not found or not owned', async () => {
      repo.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.markRead('user-1', 'notif-1')).rejects.toThrow(NotFoundException);
      expect(repo.markRead).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read for the user', async () => {
      repo.markAllRead.mockResolvedValue(undefined);

      await service.markAllRead('user-1');

      expect(repo.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });

  describe('delete', () => {
    it('should delete a notification owned by user', async () => {
      repo.findByIdAndUserId.mockResolvedValue(mockNotification);
      repo.delete.mockResolvedValue(undefined);

      await service.delete('user-1', 'notif-1');

      expect(repo.delete).toHaveBeenCalledWith('notif-1');
    });

    it('should throw NotFoundException when notification not found or not owned', async () => {
      repo.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.delete('user-1', 'notif-1')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('notify', () => {
    it('should create notification when relevant setting is enabled', async () => {
      repo.getOrCreateSettings.mockResolvedValue(mockSettings);
      repo.create.mockResolvedValue(mockNotification);

      await service.notify('user-1', NotificationType.ENROLLMENT, 'Enrolled!', 'You enrolled');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: NotificationType.ENROLLMENT }),
      );
    });

    it('should not create notification when setting is disabled', async () => {
      repo.getOrCreateSettings.mockResolvedValue({ ...mockSettings, emailOnEnrollment: false });

      await service.notify('user-1', NotificationType.ENROLLMENT, 'Enrolled!', 'You enrolled');

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should not create FORUM_REPLY notification when emailOnForumReply is false', async () => {
      repo.getOrCreateSettings.mockResolvedValue({ ...mockSettings, emailOnForumReply: false });

      await service.notify('user-1', NotificationType.FORUM_REPLY, 'New reply', 'Someone replied');

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should always create notification for types with no settings flag', async () => {
      repo.create.mockResolvedValue({ ...mockNotification, type: NotificationType.ANNOUNCEMENT });

      await service.notify('user-1', NotificationType.ANNOUNCEMENT, 'News', 'Important news');

      expect(repo.getOrCreateSettings).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: NotificationType.ANNOUNCEMENT }),
      );
    });

    it('should pass referenceId and referenceType when provided', async () => {
      repo.getOrCreateSettings.mockResolvedValue(mockSettings);
      repo.create.mockResolvedValue(mockNotification);

      await service.notify(
        'user-1',
        NotificationType.ENROLLMENT,
        'Enrolled!',
        'Body',
        'course-1',
        'course',
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ referenceId: 'course-1', referenceType: 'course' }),
      );
    });

    it('should create settings with defaults when user has none', async () => {
      const newSettings: NotificationSettings = { ...mockSettings, emailOnEnrollment: true };
      repo.getOrCreateSettings.mockResolvedValue(newSettings);
      repo.create.mockResolvedValue(mockNotification);

      await service.notify('user-1', NotificationType.ENROLLMENT, 'Enrolled!', 'Body');

      expect(repo.getOrCreateSettings).toHaveBeenCalledWith('user-1');
      expect(repo.create).toHaveBeenCalled();
    });
  });
});
