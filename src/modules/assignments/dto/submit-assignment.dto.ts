import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiProperty({ example: 'My assignment submission text', maxLength: 50000 })
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/file.pdf' })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;
}
