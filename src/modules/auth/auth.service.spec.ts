import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../../redis/redis.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { OAuthProvider } from './dto/oauth-login.dto';

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
  let authRepository: jest.Mocked<
    Pick<
      AuthRepository,
      'findByEmail' | 'findById' | 'createUser' | 'createOAuthUser' | 'setVerified'
    >
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verify'>>;
  let redisService: jest.Mocked<
    Pick<RedisService, 'get' | 'set' | 'del' | 'sadd' | 'srem' | 'expire'>
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(async () => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      createOAuthUser: jest.fn(),
      setVerified: jest.fn(),
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
      expire: jest.fn().mockResolvedValue(1),
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

  describe('sendVerification', () => {
    it('generates a 6-digit code, stores it in Redis, and returns it', async () => {
      const result = await service.sendVerification('user-123');

      expect(redisService.set).toHaveBeenCalledWith(
        'verify:user-123',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        900,
      );
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('overwrites any existing code (one active code per user)', async () => {
      await service.sendVerification('user-123');
      await service.sendVerification('user-123');

      expect(redisService.set).toHaveBeenCalledTimes(2);
      expect(redisService.set).toHaveBeenNthCalledWith(
        2,
        'verify:user-123',
        expect.any(String),
        'EX',
        900,
      );
    });
  });

  describe('verifyEmail', () => {
    it('throws BadRequestException when code has expired (no Redis key)', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.verifyEmail('user-123', '123456')).rejects.toThrow(BadRequestException);
      expect(authRepository.setVerified).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when code does not match', async () => {
      redisService.get.mockResolvedValue('654321');

      await expect(service.verifyEmail('user-123', '123456')).rejects.toThrow(BadRequestException);
      expect(authRepository.setVerified).not.toHaveBeenCalled();
    });

    it('sets user as verified and deletes Redis key on correct code', async () => {
      redisService.get.mockResolvedValue('123456');
      authRepository.setVerified.mockResolvedValue({ ...mockUser, isVerified: true });

      await service.verifyEmail('user-123', '123456');

      expect(authRepository.setVerified).toHaveBeenCalledWith('user-123');
      expect(redisService.del).toHaveBeenCalledWith('verify:user-123');
    });
  });

  describe('oauthLogin', () => {
    const baseDto = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      provider: OAuthProvider.GOOGLE,
      providerAccountId: 'google-sub-123',
    };

    it('returns tokens for an existing user without creating a new account', async () => {
      authRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.oauthLogin(baseDto);

      expect(authRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(authRepository.createOAuthUser).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('creates a new user with isVerified=true when email is not found', async () => {
      const newUser = { ...mockUser, isVerified: true };
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createOAuthUser.mockResolvedValue(newUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$oauthhash');

      const result = await service.oauthLogin(baseDto);

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(authRepository.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          passwordHash: '$2b$12$oauthhash',
          avatarUrl: null,
        }),
      );
      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.user.isVerified).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('passes avatarUrl to createOAuthUser when provided', async () => {
      const newUser = { ...mockUser, isVerified: true, avatarUrl: 'https://example.com/pic.jpg' };
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createOAuthUser.mockResolvedValue(newUser);

      await service.oauthLogin({ ...baseDto, avatarUrl: 'https://example.com/pic.jpg' });

      expect(authRepository.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: 'https://example.com/pic.jpg' }),
      );
    });

    it('stores null avatarUrl when avatarUrl is omitted', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createOAuthUser.mockResolvedValue(mockUser);

      await service.oauthLogin(baseDto);

      expect(authRepository.createOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null }),
      );
    });
  });
});
