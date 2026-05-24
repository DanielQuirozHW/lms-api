import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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

  @ApiPropertyOptional({ example: '#FF5733', description: 'Hex color code (3–8 hex digits)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{3,8}$/, { message: 'color must be a valid hex color code' })
  color?: string;

  @ApiPropertyOptional({ example: 'lesson-uuid', description: 'UUID of the referenced resource' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({
    example: 'lesson',
    description: 'Type of the referenced resource',
    enum: ['lesson', 'assignment', 'quiz', 'module'],
  })
  @IsOptional()
  @IsIn(['lesson', 'assignment', 'quiz', 'module'])
  referenceType?: string;
}
