import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @MinLength(5)
  title!: string;

  @IsOptional()
  @IsString()
  courseId?: string;
}
