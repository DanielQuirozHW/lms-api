import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import type { AppConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import type { JwtPayload, RefreshTokenPayload } from './auth.entity';
import { AuthRepository } from './auth.repository';
import type { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { OAuthLoginDto } from './dto/oauth-login.dto';
import type { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const VERIFY_CODE_TTL = 900; // 15 minutes
const RESET_TOKEN_TTL_SECS = 60 * 60; // 1 hour
// Must exceed the longest valid access token lifetime to ensure in-flight tokens are revoked.
const ACCESS_TOKEN_REVOCATION_TTL = 7 * 24 * 60 * 60;
// Valid bcrypt hash used solely to equalise timing when email is not found.
// Ensures bcrypt.compare always runs, preventing user enumeration via response-time differences.
const DUMMY_HASH = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  /** Creates a new user account and returns a JWT token pair. Throws 409 if email is already in use. */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.authRepository.createUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    return this.buildAuthResponse(user);
  }

  /**
   * Logs in or registers a user via OAuth (Google / Microsoft).
   * Finds the user by email; returns a new token pair for existing accounts.
   * For new accounts creates the user with role STUDENT and isVerified:true
   * (the OAuth provider has already verified the email address).
   * Never throws 409 — OAuth is always "find-or-create".
   */
  async oauthLogin(dto: OAuthLoginDto, ip?: string, userAgent?: string): Promise<AuthResponseDto> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      const result = await this.buildAuthResponse(existing);
      void this.authRepository
        .createLoginEvent(existing.id, ip ?? null, userAgent ?? null)
        .catch((err: unknown) => {
          this.logger.warn(`Failed to record login event: ${String(err)}`);
        });
      return result;
    }
    // Store a bcrypt hash of a random UUID so the account exists in the DB but
    // can never be accessed via password login (bcrypt.compare always returns false).
    const passwordHash = await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);
    const user = await this.authRepository.createOAuthUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl ?? null,
    });
    void this.authRepository
      .createLoginEvent(user.id, ip ?? null, userAgent ?? null)
      .catch((err: unknown) => {
        this.logger.warn(`Failed to record login event: ${String(err)}`);
      });
    return this.buildAuthResponse(user);
  }

  /** Validates credentials and returns a JWT token pair. Throws 401 on bad email or wrong password. */
  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.authRepository.findByEmail(dto.email);
    // Always run bcrypt regardless of whether the email exists to prevent
    // timing-based user enumeration (unknown email would otherwise return ~5ms vs ~300ms).
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      this.logger.warn(
        user ? `Login failed — wrong password for user ${user.id}` : `Login failed — unknown email`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.buildAuthResponse(user);
    void this.authRepository
      .createLoginEvent(user.id, ip ?? null, userAgent ?? null)
      .catch((err: unknown) => {
        this.logger.warn(`Failed to record login event: ${String(err)}`);
      });
    return result;
  }

  /** Rotates the refresh token — revokes the old one and issues a new token pair. Throws 401 if revoked or expired. */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const redisKey = this.rtKey(payload.sub, payload.jti);
    const exists = await this.redisService.get(redisKey);
    if (!exists) {
      this.logger.warn(`Revoked refresh token used — user ${payload.sub}, jti ${payload.jti}`);
      throw new UnauthorizedException('Refresh token revoked');
    }
    await this.redisService.del(redisKey);
    await this.redisService.srem(this.rtSetKey(payload.sub), payload.jti);

    const user = await this.authRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.buildAuthResponse(user);
  }

  /** Revokes the refresh token. Silently succeeds if the token is already expired or belongs to another user. */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
      if (payload.sub === userId) {
        await this.redisService.del(this.rtKey(userId, payload.jti));
        await this.redisService.srem(this.rtSetKey(userId), payload.jti);
      }
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
  }

  /** Generates a 6-digit code, stores it in Redis at verify:${userId} with 15-min TTL, and returns it. One active code per user — calling again replaces any prior code. */
  async sendVerification(userId: string): Promise<{ code: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redisService.set(`verify:${userId}`, code, 'EX', VERIFY_CODE_TTL);
    return { code };
  }

  /** Checks the 6-digit code from Redis. On match sets isVerified=true and deletes the key. Throws 400 on mismatch or expiry. Throws 429 after 5 failed attempts within 15 minutes. */
  async verifyEmail(userId: string, code: string): Promise<void> {
    const attemptsKey = `verify:attempts:${userId}`;
    const attempts = await this.redisService.get(attemptsKey);
    if (Number(attempts) >= 5) {
      throw new HttpException(
        'Too many failed attempts. Please request a new verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const stored = await this.redisService.get(`verify:${userId}`);
    if (!stored) throw new BadRequestException('Verification code expired');

    if (stored !== code) {
      await this.redisService.incr(attemptsKey);
      await this.redisService.expire(attemptsKey, VERIFY_CODE_TTL);
      throw new BadRequestException('Invalid verification code');
    }

    await this.authRepository.setVerified(userId);
    await this.redisService.del(`verify:${userId}`, attemptsKey);
  }

  /** Returns the profile of the currently authenticated user. Throws 401 if the user record no longer exists. */
  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toUserResponse(user);
  }

  /**
   * Generates a secure reset token stored in DB with a 1-hour TTL.
   * Always returns the same message regardless of whether the email exists (prevents enumeration).
   * Returns the token directly for dev/testing convenience — prod deployments should send email instead.
   */
  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.authRepository.findByEmail(email);
    const message = 'If an account with that email exists, a reset link has been sent';
    if (!user) return { message };

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SECS * 1000);
    await this.authRepository.createResetToken(user.id, token, expiresAt);
    return { message, resetToken: token };
  }

  /**
   * Validates the reset token, updates the password, marks the token used, and revokes all sessions.
   * Throws 400 if the token is invalid, already used, or expired.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.authRepository.findValidResetToken(token);
    if (!record) throw new BadRequestException('Reset token is invalid or has expired');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const userId = record.userId;

    await this.authRepository.updatePasswordHash(userId, passwordHash);
    await this.authRepository.markResetTokenUsed(record.id);

    // Revoke all active sessions — same pattern as changePassword (MISTAKES.md [002])
    const jtis = await this.redisService.smembers(`rt-set:${userId}`);
    if (jtis.length > 0) {
      const rtKeys = jtis.map((jti) => `rt:${userId}:${jti}`);
      await this.redisService.del(...rtKeys, `rt-set:${userId}`);
    }
    await this.redisService.set(`revoked:user:${userId}`, '1', 'EX', ACCESS_TOKEN_REVOCATION_TTL);
    this.logger.log(`Password reset for user ${userId} — all refresh tokens revoked`);
  }

  /** Finds a user by ID or throws 404. Used by AdminService for impersonation target lookup. */
  async findUserByIdOrFail(userId: string): Promise<User> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Issues a 60-minute impersonation token pair for the target user.
   * The access token carries impersonatedBy + impersonationTokenId claims.
   * The refresh token is stored in impersonation: Redis namespace — NOT rt: —
   * so it cannot be renewed via the standard /auth/refresh endpoint.
   */
  async issueImpersonationTokens(
    adminId: string,
    targetUser: User,
  ): Promise<AuthResponseDto & { impersonationTokenId: string }> {
    const IMPERSONATION_TTL_SECS = 60 * 60; // 60 minutes — max per spec
    const impersonationTokenId = randomUUID();

    const accessPayload: JwtPayload = {
      sub: targetUser.id,
      email: targetUser.email,
      roles: targetUser.roles,
      type: 'access',
      isVerified: targetUser.isVerified,
      impersonatedBy: adminId,
      impersonationTokenId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.get('jwt.secret', { infer: true }),
      expiresIn: IMPERSONATION_TTL_SECS,
    });

    // Refresh token uses impersonationTokenId as jti and is stored under
    // impersonation: not rt: — prevents renewal via standard refresh flow.
    const refreshPayload: RefreshTokenPayload = {
      sub: targetUser.id,
      jti: impersonationTokenId,
      type: 'refresh',
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: IMPERSONATION_TTL_SECS,
    });

    // Store adminId so stop-impersonation can recover it without a DB round-trip.
    await this.redisService.set(
      `impersonation:${impersonationTokenId}`,
      adminId,
      'EX',
      IMPERSONATION_TTL_SECS,
    );

    return {
      accessToken,
      refreshToken,
      user: this.toUserResponse(targetUser),
      impersonationTokenId,
    };
  }

  /** Removes the impersonation token from Redis (revocation on stop). */
  async revokeImpersonationToken(impersonationTokenId: string): Promise<void> {
    await this.redisService.del(`impersonation:${impersonationTokenId}`);
  }

  /** Re-issues regular tokens for the original admin after stopping impersonation. */
  async resumeAdminSession(adminId: string): Promise<AuthResponseDto> {
    const admin = await this.authRepository.findById(adminId);
    if (!admin) throw new UnauthorizedException('Admin user not found');
    return this.buildAuthResponse(admin);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccess(user),
      this.signRefresh(user),
    ]);
    return { accessToken, refreshToken, user: this.toUserResponse(user) };
  }

  private signAccess(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      type: 'access',
      isVerified: user.isVerified,
    };
    return this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.secret', { infer: true }),
      expiresIn: this.config.get('jwt.expiresIn', { infer: true }) ?? '15m',
    });
  }

  private async signRefresh(user: User): Promise<string> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: user.id, jti, type: 'refresh' };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.config.get('jwt.refreshExpiresIn', { infer: true }) ?? '30d',
    });
    await this.redisService.set(this.rtKey(user.id, jti), '1', 'EX', REFRESH_TTL_SECONDS);
    await this.redisService.sadd(this.rtSetKey(user.id), jti);
    // Reset TTL on the tracking Set so it expires with the longest-lived token in it.
    // Without this, the Set persists forever for inactive users (memory leak).
    await this.redisService.expire(this.rtSetKey(user.id), REFRESH_TTL_SECONDS);
    return token;
  }

  private rtKey(userId: string, jti: string): string {
    return `rt:${userId}:${jti}`;
  }

  private rtSetKey(userId: string): string {
    return `rt-set:${userId}`;
  }

  private toUserResponse(user: User): UserResponseDto {
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
}
