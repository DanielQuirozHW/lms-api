import { ApiProperty } from '@nestjs/swagger';
import { MinLength, IsString } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ example: 'cluser321', description: 'UUID of the user to add to the group' })
  @IsString()
  @MinLength(20)
  userId!: string;
}
