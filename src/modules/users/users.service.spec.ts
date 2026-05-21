import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@prisma/client';
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: jest.Mocked<
    Pick<UsersRepository, 'findById' | 'findByEmail' | 'update' | 'delete' | 'findAll'>
  >;
  let redisService: jest.Mocked<Pick<RedisService, 'keys' | 'del'>>;

  beforeEach(async () => {
    usersRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    redisService = {
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(0),
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

    it('hashes new password and updates when current password is correct', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);

      await service.changePassword('user-123', {
        currentPassword: 'currentpassword',
        newPassword: 'newpassword123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('currentpassword', mockUser.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(usersRepository.update).toHaveBeenCalledWith('user-123', {
        passwordHash: '$2b$12$newhash',
      });
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
    });

    it('revokes all refresh tokens and deletes account when password is correct', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.delete.mockResolvedValue(mockUser);
      redisService.keys.mockResolvedValue(['rt:user-123:jti-1', 'rt:user-123:jti-2']);
      redisService.del.mockResolvedValue(2);

      await service.deleteAccount('user-123', { password: 'correctpassword' });

      expect(redisService.keys).toHaveBeenCalledWith('rt:user-123:*');
      expect(redisService.del).toHaveBeenCalledWith('rt:user-123:jti-1', 'rt:user-123:jti-2');
      expect(usersRepository.delete).toHaveBeenCalledWith('user-123');
    });

    it('skips Redis del when user has no active sessions', async () => {
      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.delete.mockResolvedValue(mockUser);
      redisService.keys.mockResolvedValue([]);

      await service.deleteAccount('user-123', { password: 'correctpassword' });

      expect(redisService.del).not.toHaveBeenCalled();
      expect(usersRepository.delete).toHaveBeenCalledWith('user-123');
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
