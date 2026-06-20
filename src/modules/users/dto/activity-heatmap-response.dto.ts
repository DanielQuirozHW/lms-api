import { ApiProperty } from '@nestjs/swagger';

export class HeatmapDayDto {
  @ApiProperty({ example: '2024-06-01' })
  date!: string;

  @ApiProperty({ example: 3 })
  count!: number;

  @ApiProperty({ example: 1, description: '0 = none, 1 = 1–2, 2 = 3–4, 3 = 5+' })
  level!: number;
}

export class HeatmapWeekDto {
  @ApiProperty({ type: [HeatmapDayDto] })
  days!: HeatmapDayDto[];
}

export class ActivityHeatmapResponseDto {
  @ApiProperty({ type: [HeatmapWeekDto] })
  weeks!: HeatmapWeekDto[];

  @ApiProperty({ example: 84, description: 'Total days covered (always 84 = 12 weeks)' })
  totalDays!: number;
}
