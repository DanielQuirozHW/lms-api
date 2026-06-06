import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: unknown, user: T): T {
    // Never throw — return null if no token or invalid token
    return user ?? (null as T);
  }
}
