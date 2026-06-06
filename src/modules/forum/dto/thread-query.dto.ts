import { ApiPropertyOptional } from '@nestjs/swagger';
import { MinLength, IsString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ThreadQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter threads by course ID' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  courseId?: string;
}
