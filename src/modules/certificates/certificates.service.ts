import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CertificatePdfService } from './certificate-pdf.service';
import type { CertificateWithDetails } from './certificates.repository';
import { CertificatesRepository } from './certificates.repository';
import type { CertificateResponseDto, CreateCertificateDto } from './dto/certificate.dto';

@Injectable()
export class CertificatesService {
  constructor(
    private readonly certificatesRepository: CertificatesRepository,
    private readonly pdfService: CertificatePdfService,
  ) {}

  /**
   * Issues a certificate for a completed course enrollment.
   * Idempotent — returns the existing certificate if one was already issued.
   * Throws 403 if the enrollment does not belong to the caller or the course
   * is not yet complete (status !== COMPLETED and progress < 100%).
   */
  async create(
    dto: CreateCertificateDto,
    user: AuthenticatedUser,
  ): Promise<CertificateResponseDto> {
    const enrollment = await this.certificatesRepository.findEnrollmentWithProgress(
      dto.enrollmentId,
    );
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (enrollment.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this enrollment');
    }

    if (enrollment.status !== 'COMPLETED' && enrollment.progressPercentage < 100) {
      throw new ForbiddenException('Course must be completed to earn a certificate');
    }

    const certificate = await this.certificatesRepository.upsertByEnrollment({
      userId: user.id,
      courseId: enrollment.courseId,
      enrollmentId: dto.enrollmentId,
      finalGrade: enrollment.finalGrade,
    });

    return this.map(certificate);
  }

  /** Returns all certificates issued to the current user. */
  async findByUser(user: AuthenticatedUser): Promise<CertificateResponseDto[]> {
    const certs = await this.certificatesRepository.findByUserId(user.id);
    return certs.map((c) => this.map(c));
  }

  /**
   * Returns certificate data by its public verification code.
   * Public — used by the frontend verification page and download flow.
   */
  async findByCode(certificateCode: string): Promise<CertificateResponseDto> {
    const cert = await this.certificatesRepository.findByCode(certificateCode);
    if (!cert) throw new NotFoundException('Certificate not found');
    return this.map(cert);
  }

  /**
   * Generates a PDF for the given certificate code.
   * Returns the raw Buffer and a safe filename for Content-Disposition.
   */
  async generatePdf(certificateCode: string): Promise<{ buffer: Buffer; filename: string }> {
    const cert = await this.certificatesRepository.findByCode(certificateCode);
    if (!cert) throw new NotFoundException('Certificate not found');

    const buffer = await this.pdfService.generate({
      studentName: `${cert.user.firstName} ${cert.user.lastName}`,
      courseTitle: cert.course.title,
      instructorName: `${cert.course.instructor.firstName} ${cert.course.instructor.lastName}`,
      finalGrade: cert.finalGrade,
      issuedAt: cert.issuedAt,
      certificateCode: cert.certificateCode,
      courseSlug: cert.course.slug,
    });

    return { buffer, filename: `certificado-${cert.course.slug}.pdf` };
  }

  private map(cert: CertificateWithDetails): CertificateResponseDto {
    return {
      id: cert.id,
      certificateCode: cert.certificateCode,
      userId: cert.userId,
      courseId: cert.courseId,
      enrollmentId: cert.enrollmentId,
      issuedAt: cert.issuedAt,
      finalGrade: cert.finalGrade,
      course: { title: cert.course.title, slug: cert.course.slug },
      instructor: {
        firstName: cert.course.instructor.firstName,
        lastName: cert.course.instructor.lastName,
      },
    };
  }
}
