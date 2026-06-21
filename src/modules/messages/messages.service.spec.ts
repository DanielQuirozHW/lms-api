import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Message } from '@prisma/client';
import type { InboxRawRow } from './messages.repository';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

const now = new Date('2026-01-01');

const mockMessage: Message = {
  id: 'msg-1',
  senderId: 'user-1',
  receiverId: 'user-2',
  content: 'Hello',
  readAt: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  createdBy: null,
  updatedBy: null,
};

const mockInboxRow: InboxRawRow = {
  partner_id: 'user-2',
  msg_id: 'msg-1',
  sender_id: 'user-1',
  receiver_id: 'user-2',
  content: 'Hello',
  read_at: null,
  created_at: now,
  unread_count: BigInt(2),
};

const pagination = {
  page: 1,
  limit: 20,
  get skip(): number {
    return 0;
  },
};

describe('MessagesService', () => {
  let service: MessagesService;
  let repo: jest.Mocked<
    Pick<
      MessagesRepository,
      'create' | 'findInbox' | 'findConversation' | 'markConversationRead' | 'findUserById'
    >
  >;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findInbox: jest.fn(),
      findConversation: jest.fn(),
      markConversationRead: jest.fn(),
      findUserById: jest.fn().mockResolvedValue({ id: 'user-2' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService, { provide: MessagesRepository, useValue: repo }],
    }).compile();

    service = module.get(MessagesService);
  });

  describe('send', () => {
    it('should create and return a message', async () => {
      repo.create.mockResolvedValue(mockMessage);

      const result = await service.send('user-1', 'user-2', { content: 'Hello' });

      expect(repo.create).toHaveBeenCalledWith({
        senderId: 'user-1',
        receiverId: 'user-2',
        content: 'Hello',
      });
      expect(result.id).toBe('msg-1');
      expect(result.readAt).toBeNull();
    });

    it('should throw BadRequestException when sending to self', async () => {
      await expect(service.send('user-1', 'user-1', { content: 'Hello' })).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('getInbox', () => {
    it('should return paginated inbox with unread counts', async () => {
      repo.findInbox.mockResolvedValue([[mockInboxRow], 1]);

      const result = await service.getInbox('user-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].partnerId).toBe('user-2');
      expect(result.data[0].unreadCount).toBe(2);
      expect(result.data[0].lastMessage.id).toBe('msg-1');
      expect(result.meta.total).toBe(1);
    });

    it('should return empty inbox when no messages', async () => {
      repo.findInbox.mockResolvedValue([[], 0]);

      const result = await service.getInbox('user-1', pagination);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getConversation', () => {
    it('should return paginated conversation messages', async () => {
      const readMessage: Message = { ...mockMessage, readAt: now };
      repo.findConversation.mockResolvedValue([[mockMessage, readMessage], 2]);

      const result = await service.getConversation('user-1', 'user-2', pagination);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('msg-1');
      expect(result.meta.total).toBe(2);
    });

    it('should return empty result for users with no messages', async () => {
      repo.findConversation.mockResolvedValue([[], 0]);

      const result = await service.getConversation('user-1', 'user-3', pagination);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('markConversationRead', () => {
    it('should delegate to repository', async () => {
      repo.markConversationRead.mockResolvedValue(undefined);

      await service.markConversationRead('user-2', 'user-1');

      expect(repo.markConversationRead).toHaveBeenCalledWith('user-2', 'user-1');
    });
  });
});
