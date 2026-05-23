import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { AppConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import type { JwtPayload, RefreshTokenPayload } from './auth.entity';
import { AuthRepository } from './auth.repository';
import type { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
const VERIFY_CODE_TTL = 900; // 15 minutes
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

  /** Validates credentials and returns a JWT token pair. Throws 401 on bad email or wrong password. */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
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
    return this.buildAuthResponse(user);
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

  /** Checks the 6-digit code from Redis. On match sets isVerified=true and deletes the key. Throws 400 on mismatch or expiry. */
  async verifyEmail(userId: string, code: string): Promise<void> {
    const stored = await this.redisService.get(`verify:${userId}`);
    if (!stored) throw new BadRequestException('Verification code expired');
    if (stored !== code) throw new BadRequestException('Invalid verification code');
    await this.authRepository.setVerified(userId);
    await this.redisService.del(`verify:${userId}`);
  }

  /** Returns the profile of the currently authenticated user. Throws 401 if the user record no longer exists. */
  async me(userId: string): Promise<UserResponseDto> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toUserResponse(user);
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
