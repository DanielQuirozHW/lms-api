import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(skip: number, take: number): Promise<[User[], number]> {
    const where = { isActive: true };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return [data, total];
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, isActive: true } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, isActive: true } });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Soft-deletes the user by setting isActive = false. */
  delete(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  countAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { roles: { has: UserRole.ADMIN }, isActive: true } });
  }
}
