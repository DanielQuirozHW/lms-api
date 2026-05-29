import { PartialType } from '@nestjs/swagger';
import { CreateGlobalAnnouncementDto } from './create-global-announcement.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateGlobalAnnouncementDto extends PartialType(CreateGlobalAnnouncementDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
