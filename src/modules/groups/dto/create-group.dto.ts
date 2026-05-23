import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Team Alpha', description: 'Group name (minimum 2 characters)' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({
    example: 'First project group',
    description: 'Optional group description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Maximum number of members allowed in the group',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMembers?: number;
}
