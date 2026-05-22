import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserPrivateResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'john.doe@example.com' }) email!: string;
  @ApiProperty({ example: 'John' }) firstName!: string;
  @ApiProperty({ example: 'Doe' }) lastName!: string;
  @ApiProperty({ enum: UserRole, isArray: true, example: [UserRole.STUDENT] }) roles!: UserRole[];
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ example: false }) isVerified!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class UserPublicResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'John' }) firstName!: string;
  @ApiProperty({ example: 'Doe' }) lastName!: string;
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
}
