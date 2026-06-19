import { ApiProperty } from '@nestjs/swagger';

export class OverallProgressResponseDto {
  @ApiProperty({ example: 12 }) completedLessons!: number;
  @ApiProperty({ example: 48 }) totalLessons!: number;
  @ApiProperty({ example: 25.0 }) progressPercentage!: number;
}
