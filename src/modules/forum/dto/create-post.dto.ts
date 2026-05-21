import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Here is my answer to the question...', minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ example: 'post-uuid', description: 'Reply to an existing post' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
