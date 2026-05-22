import { ApiProperty } from '@nestjs/swagger';
import { RatingScale } from '@prisma/client';

export class RatingSummaryDto {
  @ApiProperty({ description: 'Average score (0 when no ratings)', example: 4.2 })
  averageScore!: number;

  @ApiProperty({ example: 37 })
  totalRatings!: number;

  @ApiProperty({ enum: RatingScale, description: 'Scale used for this course' })
  scale!: RatingScale;
}
