import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MinLength } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ example: 'Course Slides' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'https://example.com/slides.pdf' })
  @IsUrl()
  url!: string;

  @ApiProperty({ example: 'pdf', description: 'File type identifier (e.g. pdf, zip, link)' })
  @IsString()
  type!: string;
}
