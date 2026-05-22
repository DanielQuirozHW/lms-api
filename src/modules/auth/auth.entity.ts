import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  type: 'access';
  isVerified?: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: UserRole[];
  isVerified?: boolean;
}
