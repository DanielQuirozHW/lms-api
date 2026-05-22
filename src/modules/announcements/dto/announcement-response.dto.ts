import { ApiProperty } from '@nestjs/swagger';

export class AnnouncementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() courseId!: string;
  @ApiProperty() instructorId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
