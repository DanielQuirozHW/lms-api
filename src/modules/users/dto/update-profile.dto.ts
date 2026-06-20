import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: '+52 55 1234 5678' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: '1995-08-20', description: 'ISO 8601 date string' })
  @IsOptional()
  @IsISO8601()
  @Transform(({ value }: { value: unknown }) => (value ? new Date(value as string) : value))
  birthDate?: Date;

  @ApiPropertyOptional({ example: 'Mexico City, MX' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: 'Full-stack developer passionate about education.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'es', description: 'BCP 47 language code e.g. "es", "en"' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  preferredLanguage?: string;

  @ApiPropertyOptional({ example: 'dark', description: '"light", "dark", or "system"' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  preferredTheme?: string;
}
