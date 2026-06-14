import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: UserRole, example: UserRole.INSTRUCTOR })
  @IsEnum(UserRole)
  role!: UserRole;
}
