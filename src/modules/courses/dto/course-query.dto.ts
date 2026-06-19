import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CourseStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CourseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'typescript' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  categoryId?: string;

  @ApiPropertyOptional({ enum: CourseStatus, example: CourseStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
