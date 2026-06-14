import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CalendarEvent } from '@prisma/client';
import { CalendarEventType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { CalendarRepository } from './calendar.repository';
import { CalendarService } from './calendar.service';
import type { CalendarQueryDto } from './dto/calendar-query.dto';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto';

const now = new Date('2026-06-01T00:00:00.000Z');

const mockEvent: CalendarEvent = {
  id: 'event-123',
  courseId: null,
  userId: 'user-123',
  title: 'Study Session',
  description: null,
  type: CalendarEventType.CUSTOM,
  startDate: now,
  endDate: null,
  allDay: false,
  color: null,
  referenceId: null,
  referenceType: null,
  createdAt: now,
  updatedAt: now,
};

const mockCourseEvent: CalendarEvent = {
  ...mockEvent,
  id: 'event-456',
  courseId: 'course-123',
  type: CalendarEventType.ASSIGNMENT_DUE,
  title: 'Assignment Due',
};

const studentUser: AuthenticatedUser = {
  id: 'user-123',
  email: 'student@test.com',
  roles: [UserRole.STUDENT],
};

const instructorUser: AuthenticatedUser = {
  id: 'instructor-123',
  email: 'instructor@test.com',
  roles: [UserRole.INSTRUCTOR],
};

const adminUser: AuthenticatedUser = {
  id: 'admin-123',
  email: 'admin@test.com',
  roles: [UserRole.ADMIN],
};

const otherUser: AuthenticatedUser = {
  id: 'other-456',
  email: 'other@test.com',
  roles: [UserRole.STUDENT],
};

describe('CalendarService', () => {
  let service: CalendarService;
  let calendarRepository: jest.Mocked<
    Pick<
      CalendarRepository,
      | 'findForUser'
      | 'findByCourseId'
      | 'findById'
      | 'findEnrolledCourseIds'
      | 'create'
      | 'update'
      | 'delete'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;

  beforeEach(async () => {
    calendarRepository = {
      findForUser: jest.fn(),
      findByCourseId: jest.fn(),
      findById: jest.fn(),
      findEnrolledCourseIds: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    coursesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: CalendarRepository, useValue: calendarRepository },
        {
          provide: CoursesService,
          useValue: coursesService,
        },
      ],
    }).compile();

    service = module.get(CalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findEventsForUser', () => {
    it('returns mapped events combining personal and enrolled course events', async () => {
      calendarRepository.findEnrolledCourseIds.mockResolvedValue(['course-123']);
      calendarRepository.findForUser.mockResolvedValue([mockEvent, mockCourseEvent]);

      const query: CalendarQueryDto = {};
      const result = await service.findEventsForUser('user-123', query);

      expect(calendarRepository.findEnrolledCourseIds).toHaveBeenCalledWith('user-123');
      expect(calendarRepository.findForUser).toHaveBeenCalledWith(
        'user-123',
        ['course-123'],
        query,
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('event-123');
      expect(result[1].id).toBe('event-456');
    });

    it('returns empty array when user has no events', async () => {
      calendarRepository.findEnrolledCourseIds.mockResolvedValue([]);
      calendarRepository.findForUser.mockResolvedValue([]);

      const result = await service.findEventsForUser('user-123', {});

      expect(result).toHaveLength(0);
    });
  });

  describe('findCourseEvents', () => {
    it('returns mapped course events when user has access', async () => {
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        title: 'Test Course',
        slug: 'test-course',
        description: null,
        coverUrl: null,
        status: 'PUBLISHED' as const,
        enrollmentType: 'FREE' as const,
        price: null,
        instructorId: 'instructor-123',
        categoryId: null,
        enrollmentPeriodStart: null,
        enrollmentPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
        lessonsCount: 3,
        enrollmentsCount: 10,
      });
      calendarRepository.findByCourseId.mockResolvedValue([mockCourseEvent]);

      const query: CalendarQueryDto = {};
      const result = await service.findCourseEvents('course-123', studentUser, query);

      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', studentUser);
      expect(calendarRepository.findByCourseId).toHaveBeenCalledWith('course-123', query);
      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe('course-123');
    });

    it('propagates NotFoundException when course is not accessible', async () => {
      coursesService.findOne.mockRejectedValue(new NotFoundException('Course not found'));

      await expect(service.findCourseEvents('course-999', studentUser, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(calendarRepository.findByCourseId).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a personal event for any authenticated user', async () => {
      calendarRepository.create.mockResolvedValue(mockEvent);

      const dto: CreateCalendarEventDto = {
        title: 'Study Session',
        type: CalendarEventType.CUSTOM,
        startDate: '2026-06-01T09:00:00Z',
      };

      const result = await service.create('user-123', dto, studentUser);

      expect(calendarRepository.create).toHaveBeenCalled();
      expect(result.id).toBe('event-123');
    });

    it('throws ForbiddenException when a student tries to create a course event', async () => {
      const dto: CreateCalendarEventDto = {
        courseId: 'course-123',
        title: 'Assignment Due',
        type: CalendarEventType.ASSIGNMENT_DUE,
        startDate: '2026-06-10T23:59:00Z',
      };

      await expect(service.create('user-123', dto, studentUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(calendarRepository.create).not.toHaveBeenCalled();
    });

    it('allows an instructor to create a course event they own', async () => {
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        title: 'Test Course',
        slug: 'test-course',
        description: null,
        coverUrl: null,
        status: 'PUBLISHED' as const,
        enrollmentType: 'FREE' as const,
        price: null,
        instructorId: 'instructor-123',
        categoryId: null,
        enrollmentPeriodStart: null,
        enrollmentPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
        lessonsCount: 3,
        enrollmentsCount: 10,
      });
      calendarRepository.create.mockResolvedValue(mockCourseEvent);

      const dto: CreateCalendarEventDto = {
        courseId: 'course-123',
        title: 'Assignment Due',
        type: CalendarEventType.ASSIGNMENT_DUE,
        startDate: '2026-06-10T23:59:00Z',
      };

      const result = await service.create('instructor-123', dto, instructorUser);

      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', instructorUser);
      expect(calendarRepository.create).toHaveBeenCalled();
      expect(result.id).toBe('event-456');
    });

    it('throws ForbiddenException when instructor does not own the course', async () => {
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        title: 'Test Course',
        slug: 'test-course',
        description: null,
        coverUrl: null,
        status: 'PUBLISHED' as const,
        enrollmentType: 'FREE' as const,
        price: null,
        instructorId: 'another-instructor-999',
        categoryId: null,
        enrollmentPeriodStart: null,
        enrollmentPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
        lessonsCount: 3,
        enrollmentsCount: 10,
      });

      const dto: CreateCalendarEventDto = {
        courseId: 'course-123',
        title: 'Assignment Due',
        type: CalendarEventType.ASSIGNMENT_DUE,
        startDate: '2026-06-10T23:59:00Z',
      };

      await expect(service.create('instructor-123', dto, instructorUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(calendarRepository.create).not.toHaveBeenCalled();
    });

    it('allows an admin to create a course event for any course', async () => {
      coursesService.findOne.mockResolvedValue({
        id: 'course-123',
        title: 'Test Course',
        slug: 'test-course',
        description: null,
        coverUrl: null,
        status: 'PUBLISHED' as const,
        enrollmentType: 'FREE' as const,
        price: null,
        instructorId: 'some-other-instructor',
        categoryId: null,
        enrollmentPeriodStart: null,
        enrollmentPeriodEnd: null,
        createdAt: now,
        updatedAt: now,
        lessonsCount: 3,
        enrollmentsCount: 10,
      });
      calendarRepository.create.mockResolvedValue(mockCourseEvent);

      const dto: CreateCalendarEventDto = {
        courseId: 'course-123',
        title: 'Course Start',
        type: CalendarEventType.COURSE_START,
        startDate: '2026-06-01T08:00:00Z',
      };

      const result = await service.create('admin-123', dto, adminUser);

      expect(calendarRepository.create).toHaveBeenCalled();
      expect(result.courseId).toBe('course-123');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when event does not exist', async () => {
      calendarRepository.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'New title' }, studentUser),
      ).rejects.toThrow(NotFoundException);
      expect(calendarRepository.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user is not the creator and not an admin', async () => {
      calendarRepository.findById.mockResolvedValue(mockEvent); // mockEvent.userId === 'user-123'

      await expect(service.update('event-123', { title: 'Hijacked' }, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(calendarRepository.update).not.toHaveBeenCalled();
    });

    it('updates the event when called by the creator', async () => {
      const updated = { ...mockEvent, title: 'Updated Title' };
      calendarRepository.findById.mockResolvedValue(mockEvent);
      calendarRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-123', { title: 'Updated Title' }, studentUser);

      expect(calendarRepository.update).toHaveBeenCalledWith(
        'event-123',
        expect.objectContaining({ title: 'Updated Title' }),
      );
      expect(result.title).toBe('Updated Title');
    });

    it('allows an admin to update any event', async () => {
      const updated = { ...mockEvent, title: 'Admin Updated' };
      calendarRepository.findById.mockResolvedValue(mockEvent);
      calendarRepository.update.mockResolvedValue(updated);

      const result = await service.update('event-123', { title: 'Admin Updated' }, adminUser);

      expect(result.title).toBe('Admin Updated');
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when event does not exist', async () => {
      calendarRepository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent', studentUser)).rejects.toThrow(NotFoundException);
      expect(calendarRepository.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user is not the creator and not an admin', async () => {
      calendarRepository.findById.mockResolvedValue(mockEvent);

      await expect(service.delete('event-123', otherUser)).rejects.toThrow(ForbiddenException);
      expect(calendarRepository.delete).not.toHaveBeenCalled();
    });

    it('deletes the event when called by the creator', async () => {
      calendarRepository.findById.mockResolvedValue(mockEvent);
      calendarRepository.delete.mockResolvedValue(mockEvent);

      await service.delete('event-123', studentUser);

      expect(calendarRepository.delete).toHaveBeenCalledWith('event-123');
    });

    it('allows an admin to delete any event', async () => {
      calendarRepository.findById.mockResolvedValue(mockEvent);
      calendarRepository.delete.mockResolvedValue(mockEvent);

      await service.delete('event-123', adminUser);

      expect(calendarRepository.delete).toHaveBeenCalledWith('event-123');
    });
  });
});
