import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';

export class CalendarEventResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiPropertyOptional({
    example: 'clcourse123',
    description: 'Associated course ID, null for personal events',
  })
  courseId!: string | null;

  @ApiProperty({ example: 'cluser123' })
  userId!: string;

  @ApiProperty({ example: 'Project Due' })
  title!: string;

  @ApiPropertyOptional({ example: 'Final project submission deadline' })
  description!: string | null;

  @ApiProperty({ enum: CalendarEventType, example: CalendarEventType.CUSTOM })
  type!: CalendarEventType;

  @ApiProperty({ example: '2026-06-01T09:00:00.000Z' })
  startDate!: Date;

  @ApiPropertyOptional({ example: '2026-06-01T17:00:00.000Z' })
  endDate!: Date | null;

  @ApiProperty({ example: false })
  allDay!: boolean;

  @ApiPropertyOptional({ example: '#FF5733' })
  color!: string | null;

  @ApiPropertyOptional({ example: 'lesson-uuid' })
  referenceId!: string | null;

  @ApiPropertyOptional({ example: 'lesson' })
  referenceType!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
