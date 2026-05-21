import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ThreadQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter threads by course ID' })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
