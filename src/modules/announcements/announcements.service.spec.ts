import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Announcement, NotificationType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CourseAccessSettings } from './announcements.repository';
import { AnnouncementsRepository } from './announcements.repository';
import { AnnouncementsService } from './announcements.service';

const now = new Date('2026-01-01');

const mockAnnouncement: Announcement = {
  id: 'ann-1',
  courseId: 'course-1',
  instructorId: 'instructor-1',
  title: 'New module live',
  body: 'Module 3 is now available!',
  isActive: true,
  createdAt: now,
  updatedAt: now,
  createdBy: null,
  updatedBy: null,
};

const privateCourse: CourseAccessSettings = {
  instructorId: 'instructor-1',
  settings: { forumPublic: false },
};

const publicCourse: CourseAccessSettings = {
  instructorId: 'instructor-1',
  settings: { forumPublic: true },
};

const instructor: AuthenticatedUser = {
  id: 'instructor-1',
  email: 'i@test.com',
  roles: [UserRole.INSTRUCTOR],
};
const student: AuthenticatedUser = {
  id: 'student-1',
  email: 's@test.com',
  roles: [UserRole.STUDENT],
};
const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@test.com', roles: [UserRole.ADMIN] };

const pagination = {
  page: 1,
  limit: 20,
  get skip(): number {
    return 0;
  },
};

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let repo: jest.Mocked<
    Pick<
      AnnouncementsRepository,
      | 'findCourseAccessSettings'
      | 'findMany'
      | 'findById'
      | 'create'
      | 'update'
      | 'delete'
      | 'findEnrolledUserIds'
    >
  >;
  let enrollmentsService: jest.Mocked<Pick<EnrollmentsService, 'isEnrolled'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'notify'>>;

  beforeEach(async () => {
    repo = {
      findCourseAccessSettings: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findEnrolledUserIds: jest.fn(),
    };
    enrollmentsService = { isEnrolled: jest.fn() };
    notificationsService = { notify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: AnnouncementsRepository, useValue: repo },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
  });

  describe('create', () => {
    it('should create announcement and notify enrolled students', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      repo.create.mockResolvedValue(mockAnnouncement);
      repo.findEnrolledUserIds.mockResolvedValue(['student-1', 'student-2']);
      notificationsService.notify.mockResolvedValue(undefined);

      const result = await service.create(instructor, 'course-1', {
        title: 'New module live',
        body: 'Module 3 is now available!',
      });

      expect(result.id).toBe('ann-1');
      expect(notificationsService.notify).toHaveBeenCalledTimes(2);
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'student-1',
        NotificationType.ANNOUNCEMENT,
        'New module live',
        'Module 3 is now available!',
        'ann-1',
        'announcement',
      );
    });

    it('should throw NotFoundException when course does not exist', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(null);

      await expect(
        service.create(instructor, 'course-1', { title: 'Title', body: 'Body' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the course instructor', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);

      const otherInstructor: AuthenticatedUser = {
        id: 'other-instructor',
        email: 'o@test.com',
        roles: [UserRole.INSTRUCTOR],
      };

      await expect(
        service.create(otherInstructor, 'course-1', { title: 'Title', body: 'Body' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to create announcement for any course', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      repo.create.mockResolvedValue({ ...mockAnnouncement, instructorId: 'admin-1' });
      repo.findEnrolledUserIds.mockResolvedValue([]);
      notificationsService.notify.mockResolvedValue(undefined);

      const result = await service.create(admin, 'course-1', {
        title: 'Admin message',
        body: 'Important!',
      });

      expect(result.instructorId).toBe('admin-1');
    });

    it('should not notify anyone when course has no enrolled students', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      repo.create.mockResolvedValue(mockAnnouncement);
      repo.findEnrolledUserIds.mockResolvedValue([]);
      notificationsService.notify.mockResolvedValue(undefined);

      await service.create(instructor, 'course-1', { title: 'Title', body: 'Body' });

      expect(notificationsService.notify).not.toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should return announcements for a public course without auth', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(publicCourse);
      repo.findMany.mockResolvedValue([[mockAnnouncement], 1]);

      const result = await service.findMany(undefined, 'course-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(enrollmentsService.isEnrolled).not.toHaveBeenCalled();
    });

    it('should allow enrolled student to view private course announcements', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.findMany.mockResolvedValue([[mockAnnouncement], 1]);

      const result = await service.findMany(student, 'course-1', pagination);

      expect(result.data).toHaveLength(1);
    });

    it('should throw ForbiddenException for unauthenticated access to private course', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);

      await expect(service.findMany(undefined, 'course-1', pagination)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for unenrolled user on private course', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      enrollmentsService.isEnrolled.mockResolvedValue(false);

      await expect(service.findMany(student, 'course-1', pagination)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow instructor to view their own private course announcements', async () => {
      repo.findCourseAccessSettings.mockResolvedValue(privateCourse);
      repo.findMany.mockResolvedValue([[mockAnnouncement], 1]);

      const result = await service.findMany(instructor, 'course-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(enrollmentsService.isEnrolled).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an announcement as the author', async () => {
      const updated: Announcement = { ...mockAnnouncement, title: 'Updated title' };
      repo.findById.mockResolvedValue(mockAnnouncement);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(instructor, 'course-1', 'ann-1', {
        title: 'Updated title',
      });

      expect(result.title).toBe('Updated title');
    });

    it('should allow admin to update any announcement', async () => {
      const updated: Announcement = { ...mockAnnouncement, title: 'Admin update' };
      repo.findById.mockResolvedValue(mockAnnouncement);
      repo.update.mockResolvedValue(updated);

      const result = await service.update(admin, 'course-1', 'ann-1', { title: 'Admin update' });

      expect(result.title).toBe('Admin update');
    });

    it('should throw ForbiddenException when user is not the author', async () => {
      repo.findById.mockResolvedValue(mockAnnouncement);

      const other: AuthenticatedUser = {
        id: 'other',
        email: 'o@test.com',
        roles: [UserRole.INSTRUCTOR],
      };
      await expect(service.update(other, 'course-1', 'ann-1', { title: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when announcement does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update(instructor, 'course-1', 'ann-1', { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete an announcement as the author', async () => {
      repo.findById.mockResolvedValue(mockAnnouncement);
      repo.delete.mockResolvedValue(undefined);

      await expect(service.delete(instructor, 'course-1', 'ann-1')).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith('ann-1');
    });

    it('should throw ForbiddenException when user is not the author', async () => {
      repo.findById.mockResolvedValue(mockAnnouncement);

      await expect(service.delete(student, 'course-1', 'ann-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when announcement belongs to a different course', async () => {
      repo.findById.mockResolvedValue({ ...mockAnnouncement, courseId: 'other-course' });

      await expect(service.delete(instructor, 'course-1', 'ann-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
