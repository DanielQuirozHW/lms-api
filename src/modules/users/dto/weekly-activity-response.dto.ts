import { ApiProperty } from '@nestjs/swagger';

export class WeeklyActivityDayDto {
  @ApiProperty({ example: '2026-06-13' }) date!: string;
  @ApiProperty({ example: 'L' }) dayLabel!: string;
  @ApiProperty({ example: 2 }) completedLessons!: number;
  @ApiProperty({ example: 45 }) minutesWatched!: number;
}

export class WeeklyActivityResponseDto {
  @ApiProperty({ type: [WeeklyActivityDayDto] }) days!: WeeklyActivityDayDto[];
  @ApiProperty({ example: 120 }) totalMinutesThisWeek!: number;
  @ApiProperty({ example: 7 }) totalLessonsThisWeek!: number;
}
