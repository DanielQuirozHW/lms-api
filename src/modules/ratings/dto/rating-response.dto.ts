import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RatingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() score!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) review!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
