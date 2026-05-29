import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
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
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
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
}
