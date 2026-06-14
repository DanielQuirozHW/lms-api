import { ApiProperty } from '@nestjs/swagger';

export class AdminStatsDto {
  @ApiProperty({ example: 1250 }) totalUsers!: number;
  @ApiProperty({ example: 45 }) totalCourses!: number;
  @ApiProperty({ example: 3820 }) totalEnrollments!: number;
  @ApiProperty({ example: 2100 }) activeEnrollments!: number;
  @ApiProperty({ example: 890 }) completedEnrollments!: number;
}
