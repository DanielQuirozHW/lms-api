import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupResponseDto {
  @ApiProperty({ example: 'clxyz123', description: 'Group ID' })
  id!: string;

  @ApiProperty({ example: 'clcourse456', description: 'ID of the course this group belongs to' })
  courseId!: string;

  @ApiProperty({ example: 'Team Alpha', description: 'Group name' })
  name!: string;

  @ApiPropertyOptional({
    example: 'First project group',
    description: 'Optional group description',
  })
  description!: string | null;

  @ApiPropertyOptional({
    example: 5,
    description: 'Maximum number of members; null means unlimited',
  })
  maxMembers!: number | null;

  @ApiProperty({ example: 3, description: 'Current number of members in the group' })
  memberCount!: number;

  @ApiProperty({ description: 'Timestamp when the group was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'Timestamp when the group was last updated' })
  updatedAt!: Date;
}

export class GroupMemberResponseDto {
  @ApiProperty({ example: 'clmember789', description: 'Membership record ID' })
  id!: string;

  @ApiProperty({ example: 'clxyz123', description: 'ID of the group' })
  groupId!: string;

  @ApiProperty({ example: 'cluser321', description: 'ID of the user' })
  userId!: string;

  @ApiProperty({ description: 'Timestamp when the user joined the group' })
  joinedAt!: Date;
}
