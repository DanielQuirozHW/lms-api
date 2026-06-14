import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: NotificationType }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty() isRead!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) referenceId!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) referenceType!: string | null;
  @ApiProperty() createdAt!: Date;
}
