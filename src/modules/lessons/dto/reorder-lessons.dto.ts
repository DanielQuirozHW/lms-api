import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReorderLessonItemDto {
  @ApiProperty({ example: 'lesson-uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  order!: number;
}

export class ReorderLessonsDto {
  @ApiProperty({ type: [ReorderLessonItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderLessonItemDto)
  items!: ReorderLessonItemDto[];
}
