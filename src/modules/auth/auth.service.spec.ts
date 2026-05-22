import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../../redis/redis.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

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

const mockAccessToken = 'mock.access.token';
const mockRefreshToken = 'mock.refresh.token';
const mockJti = '550e8400-e29b-41d4-a716-446655440000';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<Pick<AuthRepository, 'findByEmail' | 'findById' | 'createUser'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verify'>>;
  let redisService: jest.Mocked<Pick<RedisService, 'get' | 'set' | 'del' | 'sadd' | 'srem'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(async () => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue(mockAccessToken),
      verify: jest.fn(),
    };

    redisService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(1),
    };

    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset bcrypt mocks before each test
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$newlyhashed');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // signAsync returns access token on first call, refresh token on second
    jwtService.signAsync
      .mockResolvedValueOnce(mockAccessToken)
      .mockResolvedValueOnce(mockRefreshToken);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(authRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', passwordHash: '$2b$12$newlyhashed' }),
      );
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException when email is already in use', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toThrow(ConflictException);

      expect(authRepository.createUser).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.passwordHash);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      authRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const refreshPayload = { sub: 'user-123', jti: mockJti, type: 'refresh' as const };

    it('should issue new tokens when refresh token is valid', async () => {
      jwtService.verify.mockReturnValue(refreshPayload);
      redisService.get.mockResolvedValue('1');
      authRepository.findById.mockResolvedValue(mockUser);

      const result = await service.refresh(mockRefreshToken);

      expect(jwtService.verify).toHaveBeenCalledWith(
        mockRefreshToken,
        expect.objectContaining({ secret: 'test-secret' }),
      );
      expect(redisService.get).toHaveBeenCalledWith(`rt:user-123:${mockJti}`);
      expect(redisService.del).toHaveBeenCalledWith(`rt:user-123:${mockJti}`);
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad.token.here')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is revoked', async () => {
      jwtService.verify.mockReturnValue(refreshPayload);
      redisService.get.mockResolvedValue(null);

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user no longer exists after token validation', async () => {
      jwtService.verify.mockReturnValue(refreshPayload);
      redisService.get.mockResolvedValue('1');
      authRepository.findById.mockResolvedValue(null);

      await expect(service.refresh(mockRefreshToken)).rejects.toThrow(UnauthorizedException);
      expect(redisService.del).toHaveBeenCalledWith(`rt:user-123:${mockJti}`);
    });
  });

  describe('logout', () => {
    it('should delete the refresh token from Redis', async () => {
      const payload = { sub: 'user-123', jti: mockJti, type: 'refresh' as const };
      jwtService.verify.mockReturnValue(payload);

      await service.logout('user-123', mockRefreshToken);

      expect(redisService.del).toHaveBeenCalledWith(`rt:user-123:${mockJti}`);
    });

    it('should silently succeed when refresh token is already expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.logout('user-123', 'expired.token')).resolves.not.toThrow();
      expect(redisService.del).not.toHaveBeenCalled();
    });

    it('should not revoke token when it belongs to a different user', async () => {
      const otherUserPayload = { sub: 'other-user-id', jti: mockJti, type: 'refresh' as const };
      jwtService.verify.mockReturnValue(otherUserPayload);

      await service.logout('user-123', mockRefreshToken);

      expect(redisService.del).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('should return user profile without passwordHash', async () => {
      authRepository.findById.mockResolvedValue(mockUser);

      const result = await service.me('user-123');

      expect(authRepository.findById).toHaveBeenCalledWith('user-123');
      expect(result.id).toBe('user-123');
      expect(result.email).toBe(mockUser.email);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      authRepository.findById.mockResolvedValue(null);

      await expect(service.me('nonexistent-id')).rejects.toThrow(UnauthorizedException);
    });
  });
});
