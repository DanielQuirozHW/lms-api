import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StopImpersonationDto {
  @ApiProperty({
    description: 'ID of the admin whose session should be restored',
    example: 'clxyz123',
  })
  @IsUUID()
  adminId!: string;
}
