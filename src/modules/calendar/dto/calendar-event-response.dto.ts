import { ApiProperty } from '@nestjs/swagger';
import { CalendarEventType } from '@prisma/client';

export class CalendarEventResponseDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({
    type: String,
    example: 'clcourse123',
    nullable: true,
    description: 'Associated course ID, null for personal events',
  })
  courseId!: string | null;

  @ApiProperty({ example: 'cluser123' })
  userId!: string;

  @ApiProperty({ example: 'Project Due' })
  title!: string;

  @ApiProperty({ type: String, example: 'Final project submission deadline', nullable: true })
  description!: string | null;

  @ApiProperty({ enum: CalendarEventType, example: CalendarEventType.CUSTOM })
  type!: CalendarEventType;

  @ApiProperty({ example: '2026-06-01T09:00:00.000Z' })
  startDate!: Date;

  @ApiProperty({ type: Date, example: '2026-06-01T17:00:00.000Z', nullable: true })
  endDate!: Date | null;

  @ApiProperty({ example: false })
  allDay!: boolean;

  @ApiProperty({ type: String, example: '#FF5733', nullable: true })
  color!: string | null;

  @ApiProperty({ type: String, example: 'lesson-uuid', nullable: true })
  referenceId!: string | null;

  @ApiProperty({ type: String, example: 'lesson', nullable: true })
  referenceType!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
