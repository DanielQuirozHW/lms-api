import { ApiProperty } from '@nestjs/swagger';
import { MinLength, IsString } from 'class-validator';

export class CreateCertificateDto {
  @ApiProperty({ description: 'Enrollment ID to issue the certificate for' })
  @IsString()
  @MinLength(20)
  enrollmentId!: string;
}

export class CertificateCourseDto {
  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;
}

export class CertificateInstructorDto {
  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;
}

export class CertificateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  certificateCode!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  enrollmentId!: string;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty({ type: Number, nullable: true })
  finalGrade!: number | null;

  @ApiProperty({ type: CertificateCourseDto })
  course!: CertificateCourseDto;

  @ApiProperty({ type: CertificateInstructorDto })
  instructor!: CertificateInstructorDto;
}
