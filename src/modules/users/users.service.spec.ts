import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RedisService } from '../../redis/redis.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

jest.mock('bcrypt');

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  passwordHash: '$2b$12$hashed',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['STUDENT'],
  avatarUrl: null,
  isVerified: false,
  passwordChangedAt: null,
  isActive: true,
  phone: null,
  birthDate: null,
  location: null,
  bio: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findById'
      | 'findByEmail'
      | 'update'
      | 'delete'
      | 'findAll'
      | 'countAdmins'
      | 'findAllCompletedDates'
      | 'findLastWatchedLesson'
      | 'findOverallProgressStats'
    >
  >;
  let redisService: jest.Mocked<Pick<RedisService, 'smembers' | 'del' | 'set'>>;

  beforeEach(async () => {
    usersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      countAdmins: jest.fn(),
      findAllCompletedDates: jest.fn().mockResolvedValue([]),
      findLastWatchedLesson: jest.fn().mockResolvedValue(null),
      findOverallProgressStats: jest
        .fn()
        .mockResolvedValue({ totalLessons: 0, completedLessons: 0 }),
    };

    redisService = {
      smembers: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(0),
      set: jest.fn().mockResolvedValue('OK'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$newhash');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns private profile without passwordHash', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-123');

      expect(result.id).toBe('user-123');
      expect(result.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('calls repository with correct data and returns mapped response without passwordHash', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      usersRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-123', { firstName: 'Jane' });

      expect(usersRepository.update).toHaveBeenCalledWith('user-123', { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('throws UnauthorizedException when current password is wrong', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('hashes new password, updates, revokes all refresh tokens, and sets access token revocation key', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);
      redisService.smembers.mockResolvedValue(['jti-1', 'jti-2']);
      redisService.del.mockResolvedValue(2);

      await service.changePassword('user-123', {
        currentPassword: 'currentpassword',
        newPassword: 'newpassword123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('currentpassword', mockUser.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(usersRepository.update).toHaveBeenCalledWith('user-123', {
        passwordHash: '$2b$12$newhash',
        passwordChangedAt: expect.any(Date) as Date,
      });
      expect(redisService.smembers).toHaveBeenCalledWith('rt-set:user-123');
      expect(redisService.del).toHaveBeenCalledWith(
        'rt:user-123:jti-1',
        'rt:user-123:jti-2',
        'rt-set:user-123',
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'revoked:user:user-123',
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('does not call del when user has no active sessions at password change', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);
      redisService.smembers.mockResolvedValue([]);

      await service.changePassword('user-123', {
        currentPassword: 'currentpassword',
        newPassword: 'newpassword123',
      });

      expect(redisService.del).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('throws UnauthorizedException when password is wrong', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.deleteAccount('user-123', { password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersRepository.delete).not.toHaveBeenCalled();
      expect(redisService.del).not.toHaveBeenCalled();
      expect(redisService.set).not.toHaveBeenCalled();
    });

    it('deletes DB first, then revokes all refresh tokens and sets revocation flag', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.delete.mockResolvedValue(mockUser);
      redisService.smembers.mockResolvedValue(['jti-1', 'jti-2']);
      redisService.del.mockResolvedValue(2);

      await service.deleteAccount('user-123', { password: 'correctpassword' });

      expect(usersRepository.delete).toHaveBeenCalledWith('user-123');
      expect(redisService.smembers).toHaveBeenCalledWith('rt-set:user-123');
      expect(redisService.del).toHaveBeenCalledWith(
        'rt:user-123:jti-1',
        'rt:user-123:jti-2',
        'rt-set:user-123',
      );
      expect(redisService.set).toHaveBeenCalledWith(
        'revoked:user:user-123',
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('skips refresh token del when user has no active sessions but still sets revocation flag', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.delete.mockResolvedValue(mockUser);
      redisService.smembers.mockResolvedValue([]);

      await service.deleteAccount('user-123', { password: 'correctpassword' });

      expect(usersRepository.delete).toHaveBeenCalledWith('user-123');
      expect(redisService.del).not.toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalledWith(
        'revoked:user:user-123',
        '1',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('getPublicProfile', () => {
    it('returns only public fields — no email, passwordHash, or isVerified', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);

      const result = await service.getPublicProfile('user-123');

      expect(result.id).toBe('user-123');
      expect(result.firstName).toBe(mockUser.firstName);
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('isVerified');
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(service.getPublicProfile('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRole', () => {
    it('throws BadRequestException when trying to set ADMIN role', async () => {
      await expect(service.updateRole('user-123', UserRole.ADMIN, 'admin-456')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersRepository.findById).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when admin tries to change their own role', async () => {
      await expect(
        service.updateRole('admin-123', UserRole.INSTRUCTOR, 'admin-123'),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepository.findById).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      usersRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRole('user-123', UserRole.INSTRUCTOR, 'admin-456'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when trying to demote the last admin', async () => {
      const adminUser = { ...mockUser, roles: [UserRole.ADMIN] };
      usersRepository.findById.mockResolvedValue(adminUser);
      usersRepository.countAdmins.mockResolvedValue(1);

      await expect(
        service.updateRole('user-123', UserRole.INSTRUCTOR, 'admin-456'),
      ).rejects.toThrow(BadRequestException);
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it('updates user roles and returns private response without passwordHash', async () => {
      const updatedUser = { ...mockUser, roles: [UserRole.INSTRUCTOR] };
      usersRepository.findById.mockResolvedValue(mockUser); // mockUser has STUDENT role — no admin count check
      usersRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateRole('user-123', UserRole.INSTRUCTOR, 'admin-456');

      expect(usersRepository.update).toHaveBeenCalledWith('user-123', {
        roles: [UserRole.INSTRUCTOR],
      });
      expect(usersRepository.countAdmins).not.toHaveBeenCalled();
      expect(result.roles).toEqual([UserRole.INSTRUCTOR]);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('allows demoting an admin when there is more than one admin', async () => {
      const adminUser = { ...mockUser, roles: [UserRole.ADMIN] };
      const updatedUser = { ...mockUser, roles: [UserRole.INSTRUCTOR] };
      usersRepository.findById.mockResolvedValue(adminUser);
      usersRepository.countAdmins.mockResolvedValue(2);
      usersRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateRole('user-123', UserRole.INSTRUCTOR, 'admin-456');

      expect(usersRepository.countAdmins).toHaveBeenCalled();
      expect(result.roles).toEqual([UserRole.INSTRUCTOR]);
    });
  });

  describe('getAllUsers', () => {
    it('returns paginated list with correct meta and without passwordHash', async () => {
      usersRepository.findAll.mockResolvedValue([[mockUser], 1]);

      const pagination = new PaginationDto();
      const result = await service.getAllUsers(pagination);

      expect(usersRepository.findAll).toHaveBeenCalledWith(0, 20);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
    });
  });
});
