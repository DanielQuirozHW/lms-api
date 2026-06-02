import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EnrollmentCodeResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ example: 'course-uuid' }) courseId!: string;
  @ApiProperty({ example: 'PROMO2026' }) code!: string;
  @ApiPropertyOptional({ example: 100, nullable: true }) maxUses!: number | null;
  @ApiProperty({ example: 3 }) usedCount!: number;
  @ApiPropertyOptional({ nullable: true }) expiresAt!: Date | null;
  @ApiProperty({ example: true }) isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}
