import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({ enum: UserRole, isArray: true, example: ['STUDENT'] })
  roles!: UserRole[];

  @ApiProperty({ example: 'https://cdn.example.com/avatar.jpg', nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ example: false })
  isVerified!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15 min)' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived JWT refresh token (7 days)' })
  refreshToken!: string;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
