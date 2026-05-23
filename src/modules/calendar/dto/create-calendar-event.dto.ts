import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateCalendarEventDto {
  @ApiPropertyOptional({
    example: 'clxyz123',
    description: 'Course ID to associate this event with',
  })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiProperty({ example: 'Project Due' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ example: 'Final project submission deadline' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CalendarEventType, example: CalendarEventType.CUSTOM })
  @IsEnum(CalendarEventType)
  type!: CalendarEventType;

  @ApiProperty({ example: '2026-06-01T09:00:00Z' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-06-01T17:00:00Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: '#FF5733' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'lesson-uuid', description: 'ID of the referenced resource' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'lesson', description: 'Type of the referenced resource' })
  @IsOptional()
  @IsString()
  referenceType?: string;
}
