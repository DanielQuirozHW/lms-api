import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MinLength, IsString, IsArray, IsInt, Min, ValidateNested } from 'class-validator';

export class ReorderLessonItemDto {
  @ApiProperty({ example: 'lesson-uuid' })
  @IsString()
  @MinLength(20)
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
