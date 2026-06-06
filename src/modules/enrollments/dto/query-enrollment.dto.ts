import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryEnrollmentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EnrollmentStatus, example: EnrollmentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @ApiPropertyOptional({ example: 'clxyz123...', description: 'Filter enrollments by course ID' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  courseId?: string;
}
