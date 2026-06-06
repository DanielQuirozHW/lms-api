import { ApiPropertyOptional } from '@nestjs/swagger';
import { MinLength, IsString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CourseQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  categoryId?: string;
}
