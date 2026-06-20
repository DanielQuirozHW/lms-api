import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ type: String, example: '203.0.113.5', nullable: true }) ipAddress!: string | null;
  @ApiProperty({ type: String, example: 'Mozilla/5.0', nullable: true }) userAgent!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ example: true }) isCurrent!: boolean;
}
