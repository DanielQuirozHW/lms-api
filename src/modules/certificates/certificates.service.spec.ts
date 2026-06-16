// @react-pdf/renderer is ESM-only — mock it so Jest (CommonJS) can load the module tree.
jest.mock(
  '@react-pdf/renderer',
  (): Record<string, unknown> => ({
    Document: 'Document',
    Page: 'Page',
    Text: 'Text',
    View: 'View',
    StyleSheet: { create: (s: Record<string, unknown>) => s },
    Font: { registerHyphenationCallback: jest.fn() },
    renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF mock')),
  }),
);

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Certificate } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CertificatePdfService } from './certificate-pdf.service';
import type { CertificateWithDetails } from './certificates.repository';
import { CertificatesRepository } from './certificates.repository';
import { CertificatesService } from './certificates.service';

const student: AuthenticatedUser = {
  id: 'student-001',
  email: 'student@test.com',
  roles: ['STUDENT'],
};

const rawCert: Certificate = {
  id: 'cert-001',
  certificateCode: 'CERT-CODE-XYZ',
  userId: 'student-001',
  courseId: 'course-111',
  enrollmentId: 'enrollment-222',
  issuedAt: new Date('2024-06-01'),
  finalGrade: 92.5,
  isActive: true,
  createdAt: new Date('2024-06-01'),
};

const mockCert: CertificateWithDetails = {
  ...rawCert,
  course: {
    title: 'TypeScript Basics',
    slug: 'typescript-basics',
    instructor: { firstName: 'Jane', lastName: 'Doe' },
  },
  user: { firstName: 'Alice', lastName: 'Student' },
};

const completedEnrollment = {
  id: 'enrollment-222',
  userId: 'student-001',
  courseId: 'course-111',
  status: 'COMPLETED' as const,
  progressPercentage: 100,
  finalGrade: 92.5,
};

describe('CertificatesService', () => {
  let service: CertificatesService;
  let repo: jest.Mocked<
    Pick<
      CertificatesRepository,
      'findEnrollmentWithProgress' | 'upsertByEnrollment' | 'findByUserId' | 'findByCode'
    >
  >;
  let pdfService: jest.Mocked<Pick<CertificatePdfService, 'generate'>>;

  beforeEach(async () => {
    repo = {
      findEnrollmentWithProgress: jest.fn().mockResolvedValue(completedEnrollment),
      upsertByEnrollment: jest.fn().mockResolvedValue(mockCert),
      findByUserId: jest.fn().mockResolvedValue([mockCert]),
      findByCode: jest.fn().mockResolvedValue(mockCert),
    };

    pdfService = {
      generate: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: CertificatesRepository, useValue: repo },
        { provide: CertificatePdfService, useValue: pdfService },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a certificate for a completed enrollment and returns DTO', async () => {
      const result = await service.create({ enrollmentId: 'enrollment-222' }, student);

      expect(repo.findEnrollmentWithProgress).toHaveBeenCalledWith('enrollment-222');
      expect(repo.upsertByEnrollment).toHaveBeenCalledWith({
        userId: 'student-001',
        courseId: 'course-111',
        enrollmentId: 'enrollment-222',
        finalGrade: 92.5,
      });
      expect(result.certificateCode).toBe('CERT-CODE-XYZ');
      expect(result.course.title).toBe('TypeScript Basics');
      expect(result.instructor.firstName).toBe('Jane');
    });

    it('returns existing certificate without creating a duplicate', async () => {
      await service.create({ enrollmentId: 'enrollment-222' }, student);
      await service.create({ enrollmentId: 'enrollment-222' }, student);

      // upsert is idempotent — the repository handles both cases
      expect(repo.upsertByEnrollment).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when enrollment does not exist', async () => {
      repo.findEnrollmentWithProgress.mockResolvedValue(null);

      await expect(service.create({ enrollmentId: 'bad-id' }, student)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.upsertByEnrollment).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when enrollment belongs to a different user', async () => {
      repo.findEnrollmentWithProgress.mockResolvedValue({
        ...completedEnrollment,
        userId: 'other-student',
      });

      await expect(service.create({ enrollmentId: 'enrollment-222' }, student)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repo.upsertByEnrollment).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when course is not completed and progress < 100%', async () => {
      repo.findEnrollmentWithProgress.mockResolvedValue({
        ...completedEnrollment,
        status: 'ACTIVE' as const,
        progressPercentage: 60,
      });

      await expect(service.create({ enrollmentId: 'enrollment-222' }, student)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repo.upsertByEnrollment).not.toHaveBeenCalled();
    });

    it('allows certificate when status is ACTIVE but progress is 100%', async () => {
      repo.findEnrollmentWithProgress.mockResolvedValue({
        ...completedEnrollment,
        status: 'ACTIVE' as const,
        progressPercentage: 100,
      });

      const result = await service.create({ enrollmentId: 'enrollment-222' }, student);
      expect(result.id).toBe('cert-001');
    });
  });

  describe('findByUser', () => {
    it('returns all certificates for the user, mapped to DTOs', async () => {
      const result = await service.findByUser(student);

      expect(repo.findByUserId).toHaveBeenCalledWith('student-001');
      expect(result).toHaveLength(1);
      expect(result[0].certificateCode).toBe('CERT-CODE-XYZ');
    });
  });

  describe('findByCode', () => {
    it('returns certificate data for a valid code (public access)', async () => {
      const result = await service.findByCode('CERT-CODE-XYZ');

      expect(repo.findByCode).toHaveBeenCalledWith('CERT-CODE-XYZ');
      expect(result.course.title).toBe('TypeScript Basics');
      expect(result.instructor.lastName).toBe('Doe');
    });

    it('throws NotFoundException for an unknown certificate code', async () => {
      repo.findByCode.mockResolvedValue(null);

      await expect(service.findByCode('DOES-NOT-EXIST')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generatePdf', () => {
    it('returns a PDF buffer and a safe filename', async () => {
      const result = await service.generatePdf('CERT-CODE-XYZ');

      expect(pdfService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          studentName: 'Alice Student',
          courseTitle: 'TypeScript Basics',
          instructorName: 'Jane Doe',
          certificateCode: 'CERT-CODE-XYZ',
        }),
      );
      expect(result.buffer.toString()).toContain('%PDF');
      expect(result.filename).toBe('certificado-typescript-basics.pdf');
    });

    it('throws NotFoundException when certificate code is not found', async () => {
      repo.findByCode.mockResolvedValue(null);

      await expect(service.generatePdf('BAD-CODE')).rejects.toThrow(NotFoundException);
      expect(pdfService.generate).not.toHaveBeenCalled();
    });
  });
});
