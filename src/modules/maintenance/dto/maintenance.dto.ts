import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetMaintenanceDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ example: 'Scheduled maintenance in progress. Back in 30 minutes.' })
  @IsString()
  @MaxLength(500)
  message!: string;

  @ApiProperty({ required: false, example: '2026-06-01T04:00:00Z' })
  @IsOptional()
  @IsISO8601()
  estimatedEnd?: string;
}

export class MaintenanceResponseDto {
  @ApiProperty({ example: false })
  isEnabled!: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  message!: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  estimatedEnd!: string | null;
}
