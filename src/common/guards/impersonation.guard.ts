import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser } from '../../modules/auth/auth.entity';

/**
 * Validates that impersonation tokens have not been revoked in Redis.
 * Regular tokens (no impersonationTokenId) pass through immediately.
 * Applied globally after JwtAuthGuard and RolesGuard.
 */
@Injectable()
export class ImpersonationGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user?.impersonationTokenId) return true;

    const valid = await this.redisService.get(`impersonation:${user.impersonationTokenId}`);
    if (!valid) {
      throw new UnauthorizedException('Impersonation session expired or revoked');
    }
    return true;
  }
}
