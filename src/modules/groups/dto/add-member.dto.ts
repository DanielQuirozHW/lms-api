import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'cluser321', description: 'UUID of the user to add to the group' })
  @IsUUID()
  userId!: string;
}
