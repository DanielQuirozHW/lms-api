import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from '../../../redis/redis.service';
import type { AppConfig } from '../../../config/configuration';
import type { AuthenticatedUser, JwtPayload } from '../auth.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig>,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.secret', { infer: true }) as string,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if ((payload.type as string) !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const revoked = await this.redisService.get(`revoked:user:${payload.sub}`);
    if (revoked) throw new UnauthorizedException('Token revoked');
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      isVerified: payload.isVerified,
    };
  }
}
