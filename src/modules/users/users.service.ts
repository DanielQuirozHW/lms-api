import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { paginate, type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { RedisService } from '../../redis/redis.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserPrivateResponseDto, UserPublicResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly redisService: RedisService,
  ) {}

  /** Returns the full private profile of the authenticated user. */
  async getProfile(userId: string): Promise<UserPrivateResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toPrivate(user);
  }

  /** Updates firstName, lastName, and/or avatarUrl. Prisma P2025 → 404 if the user was deleted mid-session. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserPrivateResponseDto> {
    const user = await this.usersRepository.update(userId, dto);
    return this.toPrivate(user);
  }

  /** Verifies the current password before setting the new one. Revokes all active refresh tokens. Throws 401 on wrong current password. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      this.logger.warn(`Password change failed for user ${userId} — wrong current password`);
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.update(userId, { passwordHash });

    const tokenKeys = await this.redisService.keys(`rt:${userId}:*`);
    if (tokenKeys.length > 0) {
      await this.redisService.del(...tokenKeys);
    }

    this.logger.log(`Password changed for user ${userId} — all refresh tokens revoked`);
  }

  /** Verifies password, revokes all refresh tokens in Redis, then permanently deletes the account. */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Password is incorrect');

    const tokenKeys = await this.redisService.keys(`rt:${userId}:*`);
    if (tokenKeys.length > 0) {
      await this.redisService.del(...tokenKeys);
    }

    await this.usersRepository.delete(userId);
  }

  /** Returns the public profile of any user. Never includes email, passwordHash, roles, or isVerified. */
  async getPublicProfile(id: string): Promise<UserPublicResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  /** Returns a paginated list of all users. Admin only. */
  async getAllUsers(pagination: PaginationDto): Promise<PaginatedResult<UserPrivateResponseDto>> {
    const [users, total] = await this.usersRepository.findAll(
      pagination.skip,
      pagination.limit ?? 20,
    );
    return paginate(
      users.map((u) => this.toPrivate(u)),
      total,
      pagination,
    );
  }

  private toPrivate(user: User): UserPrivateResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toPublic(user: User): UserPublicResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }
}
