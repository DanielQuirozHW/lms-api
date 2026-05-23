import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiProperty({ example: 'My assignment submission text' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/file.pdf' })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;
}
