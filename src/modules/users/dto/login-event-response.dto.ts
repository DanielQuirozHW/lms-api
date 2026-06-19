import { ApiProperty } from '@nestjs/swagger';

export class LoginEventResponseDto {
  @ApiProperty({ example: 'clxyz123' }) id!: string;
  @ApiProperty({ type: String, example: '192.168.1.1', nullable: true }) ipAddress!: string | null;
  @ApiProperty({ type: String, example: 'Mozilla/5.0...', nullable: true }) userAgent!:
    | string
    | null;
  @ApiProperty() createdAt!: Date;
}
