import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import type { JwtPayload } from '../../modules/auth/auth.entity';
import { RedisService } from '../../redis/redis.service';

interface MaintenanceState {
  isEnabled: boolean;
  message: string | null;
  estimatedEnd?: string;
}

// Paths that always bypass the maintenance check.
const EXEMPT_PATHS = ['/api/v1/health', '/api/v1/admin/maintenance'];

const REDIS_KEY = 'platform:maintenance';
const CACHE_TTL_MS = 30_000;

/**
 * Runs BEFORE JwtAuthGuard in the global guard chain.
 * When maintenance mode is active, returns 503 for all non-admin callers.
 * Admins bypass by presenting a valid ADMIN access token.
 * Redis reads are cached for 30 seconds to reduce load.
 * See MISTAKES.md [017] for related invariants.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  private cachedState: (MaintenanceState & { cachedAt: number }) | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (this.isExempt(request.path)) return true;

    const state = await this.getCachedState();
    if (!state.isEnabled) return true;

    if (this.isAdminToken(request)) return true;

    // Write the 503 directly so the response body is not shaped by
    // GlobalExceptionFilter (which always adds statusCode/error/path/timestamp).
    // Express ignores the filter's follow-up write since headers are already sent.
    response.status(503).json({
      maintenance: true,
      message: state.message,
      ...(state.estimatedEnd && { estimatedEnd: state.estimatedEnd }),
    });
    return false;
  }

  private isExempt(path: string): boolean {
    return EXEMPT_PATHS.includes(path);
  }

  private async getCachedState(): Promise<MaintenanceState> {
    const now = Date.now();
    if (this.cachedState && now - this.cachedState.cachedAt < CACHE_TTL_MS) {
      return this.cachedState;
    }
    const raw = await this.redisService.get(REDIS_KEY);
    // Support both old format ({ enabled }) and new format ({ isEnabled })
    let state: MaintenanceState;
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      state = {
        isEnabled: (parsed['isEnabled'] ?? parsed['enabled'] ?? false) as boolean,
        message: (parsed['message'] as string | null) ?? null,
        estimatedEnd: parsed['estimatedEnd'] as string | undefined,
      };
    } else {
      state = { isEnabled: false, message: null };
    }
    this.cachedState = { ...state, cachedAt: now };
    return state;
  }

  private isAdminToken(request: Request): boolean {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get('jwt.secret', { infer: true }),
      });
      return (
        (payload.type as string) === 'access' &&
        Array.isArray(payload.roles) &&
        payload.roles.includes(UserRole.ADMIN)
      );
    } catch {
      return false;
    }
  }
}
