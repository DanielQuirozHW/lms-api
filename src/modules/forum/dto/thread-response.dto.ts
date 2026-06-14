import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

export class ThreadResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() authorId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) courseId!: string | null;
  @ApiProperty() isPinned!: boolean;
  @ApiProperty() isClosed!: boolean;
  @ApiProperty() postCount!: number;
  @ApiProperty() lastActivityAt!: Date;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ThreadDetailResponseDto extends ThreadResponseDto {
  @ApiProperty({ type: PostResponseDto, isArray: true })
  posts!: PostResponseDto[];
}
