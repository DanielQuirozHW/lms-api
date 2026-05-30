import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GlobalAnnouncementType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateGlobalAnnouncementDto {
  @ApiProperty({ example: 'Scheduled maintenance on Saturday' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'The platform will be offline from 02:00–04:00 UTC.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({
    enum: GlobalAnnouncementType,
    default: GlobalAnnouncementType.INFO,
    example: GlobalAnnouncementType.INFO,
  })
  @IsOptional()
  @IsEnum(GlobalAnnouncementType)
  type?: GlobalAnnouncementType;

  @ApiPropertyOptional({
    description: 'ISO 8601 — announcement becomes visible at this time',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 — announcement stops being visible at this time',
    example: '2026-06-08T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
