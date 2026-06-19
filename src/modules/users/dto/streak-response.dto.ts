import { ApiProperty } from '@nestjs/swagger';

export class StreakResponseDto {
  @ApiProperty({ example: 5 })
  currentStreak!: number;

  @ApiProperty({ example: 21 })
  longestStreak!: number;
}
