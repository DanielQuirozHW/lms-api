import { ApiProperty } from '@nestjs/swagger';
import { GlobalAnnouncementType } from '@prisma/client';

export class GlobalAnnouncementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ enum: GlobalAnnouncementType })
  type!: GlobalAnnouncementType;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: Date, nullable: true })
  startsAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  endsAt!: Date | null;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
