import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CourseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
