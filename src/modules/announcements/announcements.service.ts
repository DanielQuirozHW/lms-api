import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type Announcement, NotificationType, UserRole } from '@prisma/client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnnouncementsRepository } from './announcements.repository';
import type { AnnouncementResponseDto } from './dto/announcement-response.dto';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto';
import type { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    user: AuthenticatedUser,
    courseId: string,
    dto: CreateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const courseData = await this.announcementsRepository.findCourseAccessSettings(courseId);
    if (!courseData) throw new NotFoundException('Course not found');

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin && courseData.instructorId !== user.id) {
      throw new ForbiddenException('Only the course instructor or admin can create announcements');
    }

    const announcement = await this.announcementsRepository.create({
      courseId,
      instructorId: user.id,
      title: dto.title,
      body: dto.body,
    });

    const enrolledUserIds = await this.announcementsRepository.findEnrolledUserIds(courseId);
    await Promise.all(
      enrolledUserIds.map((studentId) =>
        this.notificationsService.notify(
          studentId,
          NotificationType.ANNOUNCEMENT,
          dto.title,
          dto.body,
          announcement.id,
          'announcement',
        ),
      ),
    );

    return this.map(announcement);
  }

  async findMany(
    user: AuthenticatedUser | undefined,
    courseId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<AnnouncementResponseDto>> {
    const courseData = await this.announcementsRepository.findCourseAccessSettings(courseId);
    if (!courseData) throw new NotFoundException('Course not found');

    if (!courseData.settings?.forumPublic) {
      if (!user) throw new ForbiddenException('Authentication required to view announcements');

      const isAdmin = user.roles.includes(UserRole.ADMIN);
      if (!isAdmin && courseData.instructorId !== user.id) {
        const enrolled = await this.enrollmentsService.isEnrolled(user.id, courseId);
        if (!enrolled) {
          throw new ForbiddenException('You must be enrolled in this course to view announcements');
        }
      }
    }

    const [announcements, total] = await this.announcementsRepository.findMany(
      courseId,
      pagination,
    );
    return paginate(
      announcements.map((a) => this.map(a)),
      total,
      pagination,
    );
  }

  async update(
    user: AuthenticatedUser,
    courseId: string,
    id: string,
    dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementsRepository.findById(id);
    if (!announcement || announcement.courseId !== courseId) {
      throw new NotFoundException('Announcement not found');
    }

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin && announcement.instructorId !== user.id) {
      throw new ForbiddenException('You are not the author of this announcement');
    }

    const updated = await this.announcementsRepository.update(id, {
      title: dto.title,
      body: dto.body,
    });
    return this.map(updated);
  }

  async delete(user: AuthenticatedUser, courseId: string, id: string): Promise<void> {
    const announcement = await this.announcementsRepository.findById(id);
    if (!announcement || announcement.courseId !== courseId) {
      throw new NotFoundException('Announcement not found');
    }

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin && announcement.instructorId !== user.id) {
      throw new ForbiddenException('You are not the author of this announcement');
    }

    await this.announcementsRepository.delete(id);
  }

  private map(announcement: Announcement): AnnouncementResponseDto {
    return {
      id: announcement.id,
      courseId: announcement.courseId,
      instructorId: announcement.instructorId,
      title: announcement.title,
      body: announcement.body,
      createdAt: announcement.createdAt,
      updatedAt: announcement.updatedAt,
    };
  }
}
