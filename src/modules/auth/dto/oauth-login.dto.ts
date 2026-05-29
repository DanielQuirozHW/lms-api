import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
}

export class OAuthLoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John', minLength: 2 })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: 'Doe', minLength: 2 })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({
    example: 'https://lh3.googleusercontent.com/photo.jpg',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiProperty({ enum: OAuthProvider, example: OAuthProvider.GOOGLE })
  @IsEnum(OAuthProvider)
  provider!: OAuthProvider;

  @ApiProperty({
    example: '109831092341578921234',
    description: 'OAuth subject ID from the provider',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  providerAccountId!: string;
}
