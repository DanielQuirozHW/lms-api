import { Injectable } from '@nestjs/common';
import type { LoginEvent, PasswordResetToken, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

interface CreateOAuthUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, isActive: true } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }

  createUser(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  createOAuthUser(data: CreateOAuthUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl ?? null,
        isVerified: true,
      },
    });
  }

  setVerified(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { isVerified: true } });
  }

  createResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data: { userId, token, expiresAt } });
  }

  findValidResetToken(token: string): Promise<(PasswordResetToken & { user: User }) | null> {
    const now = new Date();
    return this.prisma.passwordResetToken.findFirst({
      where: { token, usedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
  }

  markResetTokenUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  createLoginEvent(
    userId: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<LoginEvent> {
    return this.prisma.loginEvent.create({ data: { userId, ipAddress, userAgent } });
  }
}
