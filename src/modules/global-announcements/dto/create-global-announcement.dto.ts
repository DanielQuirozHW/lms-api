import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    enum: GlobalAnnouncementType,
    default: GlobalAnnouncementType.INFO,
    required: false,
  })
  @IsOptional()
  @IsEnum(GlobalAnnouncementType)
  type?: GlobalAnnouncementType;

  @ApiProperty({
    required: false,
    description: 'ISO 8601 — announcement becomes visible at this time',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiProperty({
    required: false,
    description: 'ISO 8601 — announcement stops being visible at this time',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
