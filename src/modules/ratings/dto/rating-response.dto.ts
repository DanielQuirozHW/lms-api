import { ApiProperty } from '@nestjs/swagger';

export class RatingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() score!: number;
  @ApiProperty({ type: String, nullable: true }) review!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
