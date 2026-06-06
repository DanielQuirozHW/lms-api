import { ApiProperty } from '@nestjs/swagger';
import { MinLength, IsString } from 'class-validator';

export class StopImpersonationDto {
  @ApiProperty({
    description: 'ID of the admin whose session should be restored',
    example: 'clxyz123',
  })
  @IsString()
  @MinLength(20)
  adminId!: string;
}
