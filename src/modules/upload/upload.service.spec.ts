import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { StorageService } from '../../storage/storage.service';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { LessonsService } from '../lessons/lessons.service';
import { UsersService } from '../users/users.service';
import { UploadService } from './upload.service';

// file-type uses ESM internally (strtok3 dependency) — mock it so Jest can load this spec
jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockResolvedValue(null),
}));

const mockUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'user-123',
  email: 'test@example.com',
  roles: ['INSTRUCTOR'],
  isVerified: true,
  ...overrides,
});

const mockFile = (mimetype = 'image/jpeg', size = 1024): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'test.jpg',
  encoding: '7bit',
  mimetype,
  buffer: Buffer.from('test-data'),
  size,
  stream: undefined as never,
  destination: '',
  filename: '',
  path: '',
});

const UPLOAD_URL = 'https://cdn.example.com/test.jpg';
const PRESIGNED_URL = 'https://r2.example.com/presigned?sig=abc';

describe('UploadService', () => {
  let service: UploadService;
  let storageService: jest.Mocked<
    Pick<StorageService, 'upload' | 'getPresignedUploadUrl' | 'getPublicUrl'>
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'updateProfile'>>;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne' | 'update'>>;
  let lessonsService: jest.Mocked<Pick<LessonsService, 'getLessonCourseId'>>;

  beforeEach(async () => {
    storageService = {
      upload: jest.fn().mockResolvedValue(UPLOAD_URL),
      getPresignedUploadUrl: jest.fn().mockResolvedValue(PRESIGNED_URL),
      getPublicUrl: jest.fn().mockReturnValue('https://cdn.example.com/key'),
    };
    usersService = { updateProfile: jest.fn().mockResolvedValue({}) };
    coursesService = {
      findOne: jest.fn().mockResolvedValue({ id: 'course-123', instructorId: 'user-123' }),
      update: jest.fn().mockResolvedValue({}),
    };
    lessonsService = { getLessonCourseId: jest.fn().mockResolvedValue('course-123') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: StorageService, useValue: storageService },
        { provide: UsersService, useValue: usersService },
        { provide: CoursesService, useValue: coursesService },
        { provide: LessonsService, useValue: lessonsService },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  describe('uploadAvatar', () => {
    it('uploads file and updates user avatarUrl', async () => {
      const user = mockUser();
      const file = mockFile('image/jpeg');
      const result = await service.uploadAvatar(user, file);
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^avatars\/user-123\/.+\.jpg$/),
        file.buffer,
        'image/jpeg',
      );
      expect(usersService.updateProfile).toHaveBeenCalledWith('user-123', {
        avatarUrl: UPLOAD_URL,
      });
      expect(result.url).toBe(UPLOAD_URL);
    });

    it('supports png and webp mime types', async () => {
      const user = mockUser();
      await service.uploadAvatar(user, mockFile('image/png'));
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        expect.any(Buffer),
        'image/png',
      );
    });

    it('throws BadRequestException for invalid mime type', async () => {
      const user = mockUser();
      await expect(service.uploadAvatar(user, mockFile('video/mp4'))).rejects.toThrow(
        BadRequestException,
      );
      expect(storageService.upload).not.toHaveBeenCalled();
    });
  });

  describe('uploadCourseCover', () => {
    const dto = { courseId: 'course-123' };

    it('uploads cover and updates course coverUrl', async () => {
      const user = mockUser();
      const file = mockFile('image/png');
      const result = await service.uploadCourseCover(user, dto, file);
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^courses\/course-123\/cover\/.+\.png$/),
        file.buffer,
        'image/png',
      );
      expect(coursesService.update).toHaveBeenCalledWith('course-123', { coverUrl: UPLOAD_URL });
      expect(result.url).toBe(UPLOAD_URL);
    });

    it('throws ForbiddenException when user does not own course', async () => {
      const user = mockUser({ id: 'other-user' });
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        instructorId: 'user-123',
      } as never);
      await expect(service.uploadCourseCover(user, dto, mockFile())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows admin to upload to any course', async () => {
      const admin = mockUser({ id: 'admin-id', roles: ['ADMIN'] });
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        instructorId: 'user-123',
      } as never);
      await service.uploadCourseCover(admin, dto, mockFile());
      expect(storageService.upload).toHaveBeenCalled();
    });

    it('throws BadRequestException for non-image file', async () => {
      await expect(
        service.uploadCourseCover(mockUser(), dto, mockFile('application/pdf')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateLessonVideoUploadUrl', () => {
    const dto = { lessonId: 'lesson-123', contentType: 'video/mp4' };

    it('returns presigned upload URL after verifying ownership', async () => {
      const result = await service.generateLessonVideoUploadUrl(mockUser(), dto);
      expect(lessonsService.getLessonCourseId).toHaveBeenCalledWith('lesson-123');
      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', expect.anything());
      expect(storageService.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/^lessons\/course-123\/lesson-123\/.+\.mp4$/),
        'video/mp4',
        3600,
      );
      expect(result.uploadUrl).toBe(PRESIGNED_URL);
      expect(result.key).toMatch(/\.mp4$/);
    });

    it('uses .webm extension for webm content type', async () => {
      await service.generateLessonVideoUploadUrl(mockUser(), {
        ...dto,
        contentType: 'video/webm',
      });
      expect(storageService.getPresignedUploadUrl).toHaveBeenCalledWith(
        expect.stringMatching(/\.webm$/),
        'video/webm',
        3600,
      );
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      lessonsService.getLessonCourseId.mockRejectedValue(new NotFoundException('Lesson not found'));
      await expect(service.generateLessonVideoUploadUrl(mockUser(), dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user does not own the course', async () => {
      const user = mockUser({ id: 'other-user' });
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        instructorId: 'user-123',
      } as never);
      await expect(service.generateLessonVideoUploadUrl(user, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('uploadAssignmentFile', () => {
    it('uploads pdf and returns URL', async () => {
      const result = await service.uploadAssignmentFile(mockUser(), mockFile('application/pdf'));
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^submissions\/user-123\/.+\.pdf$/),
        expect.any(Buffer),
        'application/pdf',
      );
      expect(result.url).toBe(UPLOAD_URL);
    });

    it('uploads zip file', async () => {
      await service.uploadAssignmentFile(mockUser(), mockFile('application/zip'));
      expect(storageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/\.zip$/),
        expect.any(Buffer),
        'application/zip',
      );
    });

    it('throws BadRequestException for invalid file type', async () => {
      await expect(service.uploadAssignmentFile(mockUser(), mockFile('video/mp4'))).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
