import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
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
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
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
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
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
      throw new UnauthorizedException('Refresh token revoked');
    }
    await this.redisService.del(redisKey);

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
      }
    } catch {
      // Token already expired or invalid — nothing to revoke
    }
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
      role: user.role,
      type: 'access',
    };
    return this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.secret', { infer: true }),
      expiresIn: '15m',
    });
  }

  private async signRefresh(user: User): Promise<string> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: user.id, jti, type: 'refresh' };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: '7d',
    });
    await this.redisService.set(this.rtKey(user.id, jti), '1', 'EX', REFRESH_TTL_SECONDS);
    return token;
  }

  private rtKey(userId: string, jti: string): string {
    return `rt:${userId}:${jti}`;
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
