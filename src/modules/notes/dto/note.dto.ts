import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertNoteDto {
  @ApiProperty({ example: 'Great explanation of closures here.', minLength: 1, maxLength: 10000 })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;
}

export class NoteResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  lessonId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
