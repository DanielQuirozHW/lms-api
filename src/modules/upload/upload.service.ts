import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { StorageService } from '../../storage/storage.service';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { LessonsService } from '../lessons/lessons.service';
import { UsersService } from '../users/users.service';
import type { UploadCourseCoverDto } from './dto/upload-course-cover.dto';
import type { UploadLessonVideoDto } from './dto/upload-lesson-video.dto';
import type { UploadResponseDto, VideoUploadResponseDto } from './dto/upload-response.dto';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const ASSIGNMENT_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Detect MIME type from magic bytes; falls back to file.mimetype if undetectable (e.g. plain text). */
async function detectMimeType(buffer: Buffer, fallback: string): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  return detected?.mime ?? fallback;
}

@Injectable()
export class UploadService {
  constructor(
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
  ) {}

  async uploadAvatar(
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const mime = await detectMimeType(file.buffer, file.mimetype);
    const ext = IMAGE_TYPES[mime];
    if (!ext) throw new BadRequestException('Invalid file type. Allowed: jpg, png, webp');

    const key = `avatars/${user.id}/${randomUUID()}.${ext}`;
    const url = await this.storageService.upload(key, file.buffer, mime);
    await this.usersService.updateProfile(user.id, { avatarUrl: url });
    return { url };
  }

  async uploadCourseCover(
    user: AuthenticatedUser,
    dto: UploadCourseCoverDto,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const mime = await detectMimeType(file.buffer, file.mimetype);
    const ext = IMAGE_TYPES[mime];
    if (!ext) throw new BadRequestException('Invalid file type. Allowed: jpg, png, webp');

    const course = await this.coursesService.findOne(dto.courseId, user);
    if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }

    const key = `courses/${dto.courseId}/cover/${randomUUID()}.${ext}`;
    const url = await this.storageService.upload(key, file.buffer, mime);
    await this.coursesService.update(dto.courseId, { coverUrl: url });
    return { url };
  }

  async generateLessonVideoUploadUrl(
    user: AuthenticatedUser,
    dto: UploadLessonVideoDto,
  ): Promise<VideoUploadResponseDto> {
    const ext = VIDEO_TYPES[dto.contentType];
    if (!ext) throw new BadRequestException('Invalid content type. Allowed: video/mp4, video/webm');

    const courseId = await this.lessonsService.getLessonCourseId(dto.lessonId);
    const course = await this.coursesService.findOne(courseId, user);
    if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }

    const key = `lessons/${courseId}/${dto.lessonId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.storageService.getPresignedUploadUrl(key, dto.contentType, 3600);
    const publicUrl = this.storageService.getPublicUrl(key);
    return { uploadUrl, key, publicUrl };
  }

  async uploadAssignmentFile(
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    const mime = await detectMimeType(file.buffer, file.mimetype);
    const ext = ASSIGNMENT_FILE_TYPES[mime];
    if (!ext) {
      throw new BadRequestException('Invalid file type. Allowed: pdf, docx, zip, jpg, png');
    }

    const key = `submissions/${user.id}/${randomUUID()}.${ext}`;
    const url = await this.storageService.upload(key, file.buffer, mime);
    return { url };
  }
}
