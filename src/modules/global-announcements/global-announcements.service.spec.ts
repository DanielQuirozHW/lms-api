import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { GlobalAnnouncementType, type GlobalAnnouncement } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { GlobalAnnouncementsRepository } from './global-announcements.repository';
import { GlobalAnnouncementsService } from './global-announcements.service';

const adminUser: AuthenticatedUser = { id: 'admin-1', email: 'admin@test.com', roles: ['ADMIN'] };
const otherAdmin: AuthenticatedUser = { id: 'admin-2', email: 'other@test.com', roles: ['ADMIN'] };

const mockAnnouncement: GlobalAnnouncement = {
  id: 'ann-123',
  title: 'Maintenance tonight',
  message: 'We will be down from 02:00–04:00 UTC.',
  type: GlobalAnnouncementType.MAINTENANCE,
  isActive: true,
  startsAt: null,
  endsAt: null,
  createdBy: 'admin-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('GlobalAnnouncementsService', () => {
  let service: GlobalAnnouncementsService;
  let repo: jest.Mocked<
    Pick<GlobalAnnouncementsRepository, 'findActive' | 'create' | 'findById' | 'update' | 'delete'>
  >;

  beforeEach(async () => {
    repo = {
      findActive: jest.fn().mockResolvedValue([mockAnnouncement]),
      create: jest.fn().mockResolvedValue(mockAnnouncement),
      findById: jest.fn().mockResolvedValue(mockAnnouncement),
      update: jest.fn().mockResolvedValue(mockAnnouncement),
      delete: jest.fn().mockResolvedValue(mockAnnouncement),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalAnnouncementsService,
        { provide: GlobalAnnouncementsRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<GlobalAnnouncementsService>(GlobalAnnouncementsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findActive', () => {
    it('returns mapped active announcements', async () => {
      const result = await service.findActive();
      expect(repo.findActive).toHaveBeenCalledWith(expect.any(Date));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ann-123');
      expect(result[0]).not.toHaveProperty('author');
    });

    it('returns empty array when no active announcements exist', async () => {
      repo.findActive.mockResolvedValue([]);
      const result = await service.findActive();
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates an announcement and returns mapped result', async () => {
      const result = await service.create(
        {
          title: 'Maintenance tonight',
          message: 'Down 02-04 UTC',
          type: GlobalAnnouncementType.MAINTENANCE,
        },
        adminUser,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Maintenance tonight',
          author: { connect: { id: 'admin-1' } },
        }),
      );
      expect(result.id).toBe('ann-123');
    });

    it('converts startsAt and endsAt strings to Date objects', async () => {
      await service.create(
        {
          title: 'T',
          message: 'M',
          startsAt: '2026-06-01T00:00:00Z',
          endsAt: '2026-06-02T00:00:00Z',
        },
        adminUser,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startsAt: new Date('2026-06-01T00:00:00Z'),
          endsAt: new Date('2026-06-02T00:00:00Z'),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates the announcement when caller is the owner', async () => {
      const result = await service.update('ann-123', { title: 'Updated' }, adminUser);
      expect(repo.update).toHaveBeenCalledWith(
        'ann-123',
        expect.objectContaining({ title: 'Updated' }),
      );
      expect(result.id).toBe('ann-123');
    });

    it('allows any admin to update regardless of ownership', async () => {
      await service.update('ann-123', { isActive: false }, otherAdmin);
      expect(repo.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when announcement does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('bad-id', { title: 'X' }, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes when caller is admin', async () => {
      await service.delete('ann-123', adminUser);
      expect(repo.delete).toHaveBeenCalledWith('ann-123');
    });

    it('throws NotFoundException when announcement does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('bad-id', adminUser)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin non-owner tries to delete', async () => {
      const student: AuthenticatedUser = { id: 'student-1', email: 's@t.com', roles: ['STUDENT'] };
      await expect(service.delete('ann-123', student)).rejects.toThrow(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
