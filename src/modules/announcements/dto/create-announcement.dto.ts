import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Module 3 is now live' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'We have just published module 3. Check it out!' })
  @IsString()
  @MinLength(1)
  body!: string;
}
