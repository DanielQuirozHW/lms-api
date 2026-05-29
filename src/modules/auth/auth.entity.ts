import type { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  type: 'access';
  isVerified?: boolean;
  /** Present only on impersonation tokens — ID of the admin who initiated. */
  impersonatedBy?: string;
  /** Unique ID for this impersonation session; used to revoke via Redis. */
  impersonationTokenId?: string;
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
  /** Set when the request is made with an impersonation token. */
  impersonatedBy?: string;
  impersonationTokenId?: string;
}
