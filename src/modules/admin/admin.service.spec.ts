import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { AuthService } from '../auth/auth.service';
import { AdminService } from './admin.service';
import { ImpersonationLogService } from './impersonation.log.service';

const mockAdmin: AuthenticatedUser = {
  id: 'admin-001',
  email: 'admin@test.com',
  roles: ['ADMIN'],
  isVerified: true,
};

const mockStudent: User = {
  id: 'student-001',
  email: 'student@test.com',
  passwordHash: '$2b$12$hash',
  firstName: 'Jane',
  lastName: 'Student',
  roles: ['STUDENT'],
  avatarUrl: null,
  isVerified: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockAdminUser: User = {
  ...mockStudent,
  id: 'admin-002',
  email: 'otheradmin@test.com',
  roles: ['ADMIN'],
};

const mockTokens = {
  accessToken: 'imp.access.token',
  refreshToken: 'imp.refresh.token',
  user: {
    id: mockStudent.id,
    email: mockStudent.email,
    firstName: mockStudent.firstName,
    lastName: mockStudent.lastName,
    roles: mockStudent.roles,
    avatarUrl: null,
    isVerified: true,
    createdAt: mockStudent.createdAt,
    updatedAt: mockStudent.updatedAt,
  },
  impersonationTokenId: 'imp-token-uuid',
};

const mockAdminTokens = {
  accessToken: 'admin.access.token',
  refreshToken: 'admin.refresh.token',
  user: {
    id: mockAdmin.id,
    email: mockAdmin.email,
    firstName: 'Admin',
    lastName: 'User',
    roles: ['ADMIN'],
    avatarUrl: null,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('AdminService', () => {
  let service: AdminService;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      | 'findUserByIdOrFail'
      | 'issueImpersonationTokens'
      | 'revokeImpersonationToken'
      | 'resumeAdminSession'
    >
  >;
  let logService: jest.Mocked<
    Pick<ImpersonationLogService, 'logImpersonationStart' | 'logImpersonationStop'>
  >;

  beforeEach(async () => {
    authService = {
      findUserByIdOrFail: jest.fn(),
      issueImpersonationTokens: jest.fn().mockResolvedValue(mockTokens),
      revokeImpersonationToken: jest.fn().mockResolvedValue(undefined),
      resumeAdminSession: jest.fn().mockResolvedValue(mockAdminTokens),
    };

    logService = {
      logImpersonationStart: jest.fn(),
      logImpersonationStop: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AuthService, useValue: authService },
        { provide: ImpersonationLogService, useValue: logService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('startImpersonation', () => {
    it('issues impersonation tokens for a valid STUDENT target', async () => {
      authService.findUserByIdOrFail.mockResolvedValue(mockStudent);

      const result = await service.startImpersonation(mockAdmin, mockStudent.id);

      expect(authService.findUserByIdOrFail).toHaveBeenCalledWith(mockStudent.id);
      expect(authService.issueImpersonationTokens).toHaveBeenCalledWith(mockAdmin.id, mockStudent);
      expect(logService.logImpersonationStart).toHaveBeenCalledWith(
        mockAdmin.id,
        mockStudent.id,
        mockTokens.impersonationTokenId,
      );
      expect(result.accessToken).toBe(mockTokens.accessToken);
      expect(result).not.toHaveProperty('impersonationTokenId');
    });

    it('throws BadRequestException when admin tries to impersonate themselves', async () => {
      await expect(service.startImpersonation(mockAdmin, mockAdmin.id)).rejects.toThrow(
        BadRequestException,
      );

      expect(authService.findUserByIdOrFail).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is already in an impersonation session', async () => {
      const alreadyImpersonating: AuthenticatedUser = {
        ...mockAdmin,
        impersonatedBy: 'some-other-admin',
        impersonationTokenId: 'existing-token',
      };

      await expect(
        service.startImpersonation(alreadyImpersonating, mockStudent.id),
      ).rejects.toThrow(ForbiddenException);

      expect(authService.findUserByIdOrFail).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when target user has ADMIN role', async () => {
      authService.findUserByIdOrFail.mockResolvedValue(mockAdminUser);

      await expect(service.startImpersonation(mockAdmin, mockAdminUser.id)).rejects.toThrow(
        ForbiddenException,
      );

      expect(authService.issueImpersonationTokens).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when target user does not exist', async () => {
      authService.findUserByIdOrFail.mockRejectedValue(new NotFoundException('User not found'));

      await expect(service.startImpersonation(mockAdmin, 'nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('stopImpersonation', () => {
    const impersonatingUser: AuthenticatedUser = {
      id: mockStudent.id,
      email: mockStudent.email,
      roles: mockStudent.roles,
      impersonatedBy: mockAdmin.id,
      impersonationTokenId: 'imp-token-uuid',
    };

    it('revokes the impersonation token and returns admin tokens', async () => {
      const result = await service.stopImpersonation(impersonatingUser, { adminId: mockAdmin.id });

      expect(authService.revokeImpersonationToken).toHaveBeenCalledWith('imp-token-uuid');
      expect(logService.logImpersonationStop).toHaveBeenCalledWith(
        mockAdmin.id,
        mockStudent.id,
        'imp-token-uuid',
      );
      expect(authService.resumeAdminSession).toHaveBeenCalledWith(mockAdmin.id);
      expect(result.accessToken).toBe(mockAdminTokens.accessToken);
    });

    it('throws BadRequestException when not currently impersonating', async () => {
      await expect(service.stopImpersonation(mockAdmin, { adminId: mockAdmin.id })).rejects.toThrow(
        BadRequestException,
      );

      expect(authService.revokeImpersonationToken).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when adminId in body does not match JWT impersonatedBy', async () => {
      await expect(
        service.stopImpersonation(impersonatingUser, { adminId: 'wrong-admin-id' }),
      ).rejects.toThrow(BadRequestException);

      expect(authService.revokeImpersonationToken).not.toHaveBeenCalled();
    });
  });
});
