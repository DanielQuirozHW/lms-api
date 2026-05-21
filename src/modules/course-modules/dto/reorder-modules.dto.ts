import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @ApiProperty({ example: 'module-uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  order!: number;
}

export class ReorderModulesDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}
