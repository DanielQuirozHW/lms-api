import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class BulkEnrollDto {
  @ApiProperty({
    example: ['clxyz123...', 'clxyz456...'],
    description: 'User IDs to enroll',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(20, { each: true })
  userIds!: string[];

  @ApiProperty({ example: 'clxyz123...' })
  @IsString()
  @MinLength(20)
  courseId!: string;
}
