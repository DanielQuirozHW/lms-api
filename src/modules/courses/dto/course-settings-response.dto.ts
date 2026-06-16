import { ApiProperty } from '@nestjs/swagger';
import { RatingScale } from '@prisma/client';

export class CourseSettingsResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty({ type: Date, nullable: true }) enrollmentStartDate!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) enrollmentEndDate!: Date | null;
  @ApiProperty({ type: Date, nullable: true }) courseStartDate!: Date | null;
  @ApiProperty() hasModules!: boolean;
  @ApiProperty() forumEnabled!: boolean;
  @ApiProperty() forumPublic!: boolean;
  @ApiProperty() certificateEnabled!: boolean;
  @ApiProperty() ratingEnabled!: boolean;
  @ApiProperty({ enum: RatingScale }) ratingScale!: RatingScale;
  @ApiProperty({ type: Number, nullable: true }) maxEnrollments!: number | null;
  @ApiProperty() isSequential!: boolean;
}
