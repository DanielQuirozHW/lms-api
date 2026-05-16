import type { UserRole } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: UserRole;
  avatarUrl!: string | null;
  isVerified!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserResponseDto;
}
