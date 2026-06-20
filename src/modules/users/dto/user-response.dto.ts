import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class UserPrivateResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'john.doe@example.com' }) email!: string;
  @ApiProperty({ example: 'John' }) firstName!: string;
  @ApiProperty({ example: 'Doe' }) lastName!: string;
  @ApiProperty({ enum: UserRole, isArray: true, example: [UserRole.STUDENT] }) roles!: UserRole[];
  @ApiProperty({ type: String, example: null, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ example: false }) isVerified!: boolean;
  @ApiPropertyOptional({ type: String, example: null, nullable: true }) phone!: string | null;
  @ApiPropertyOptional({ type: Date, example: null, nullable: true }) birthDate!: Date | null;
  @ApiPropertyOptional({ type: String, example: null, nullable: true }) location!: string | null;
  @ApiPropertyOptional({ type: String, example: null, nullable: true }) bio!: string | null;
  @ApiProperty({ example: 'es' }) preferredLanguage!: string;
  @ApiProperty({ example: 'dark' }) preferredTheme!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class UserPublicResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'John' }) firstName!: string;
  @ApiProperty({ example: 'Doe' }) lastName!: string;
  @ApiProperty({ type: String, example: null, nullable: true }) avatarUrl!: string | null;
}
