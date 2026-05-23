import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GradingType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAssignmentSettingsDto {
  @ApiProperty({ enum: GradingType, example: GradingType.MANUAL })
  @IsEnum(GradingType)
  gradingType!: GradingType;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxScore!: number;

  @ApiPropertyOptional({ example: 70 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({ example: '2026-06-01T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isGroupAssignment?: boolean;

  @ApiPropertyOptional({ description: 'Group ID for group assignments' })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
