import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @MinLength(5)
  title!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;
}
