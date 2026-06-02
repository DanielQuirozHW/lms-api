import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEnrollmentCodeDto {
  @ApiProperty({ example: 'PROMO2026', description: 'Unique enrollment code string' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  code!: string;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum number of times the code can be used',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59Z',
    description: 'ISO 8601 expiry date; null means never expires',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
