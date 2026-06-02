import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkEnrollDto {
  @ApiProperty({
    example: ['user-uuid-1', 'user-uuid-2'],
    description: 'User IDs to enroll',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  userIds!: string[];

  @ApiProperty({ example: 'course-uuid' })
  @IsUUID()
  courseId!: string;
}
