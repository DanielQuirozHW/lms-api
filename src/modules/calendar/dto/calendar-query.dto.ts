import { ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class CalendarQueryDto {
  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Filter events starting on or after this date',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description: 'Filter events starting on or before this date',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: CalendarEventType, description: 'Filter by event type' })
  @IsOptional()
  @IsEnum(CalendarEventType)
  type?: CalendarEventType;
}
