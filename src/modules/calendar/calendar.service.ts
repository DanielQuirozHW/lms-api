import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CalendarEvent } from '@prisma/client';
import { CalendarEventType, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { CalendarRepository } from './calendar.repository';
import type { CalendarEventResponseDto } from './dto/calendar-event-response.dto';
import type { CalendarQueryDto } from './dto/calendar-query.dto';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import type { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly coursesService: CoursesService,
  ) {}

  /** Returns all events visible to the user: personal events + events from enrolled courses. */
  async findEventsForUser(
    userId: string,
    query: CalendarQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    const enrolledCourseIds = await this.calendarRepository.findEnrolledCourseIds(userId);
    const events = await this.calendarRepository.findForUser(userId, enrolledCourseIds, query);
    return events.map((e) => this.map(e));
  }

  /**
   * Returns calendar events for a specific course.
   * Access is granted if the caller can view the course (owner, admin, or enrolled student on a published course).
   */
  async findCourseEvents(
    courseId: string,
    user: AuthenticatedUser,
    query: CalendarQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    // coursesService.findOne enforces visibility: DRAFT/ARCHIVED only visible to owner or admin
    await this.coursesService.findOne(courseId, user);
    const events = await this.calendarRepository.findByCourseId(courseId, query);
    return events.map((e) => this.map(e));
  }

  /**
   * Creates a calendar event.
   * Personal events (no courseId) can be created by any authenticated user.
   * Course events require the caller to be an INSTRUCTOR or ADMIN.
   */
  async create(
    userId: string,
    dto: CreateCalendarEventDto,
    user: AuthenticatedUser,
  ): Promise<CalendarEventResponseDto> {
    if (
      dto.courseId &&
      !user.roles.includes(UserRole.INSTRUCTOR) &&
      !user.roles.includes(UserRole.ADMIN)
    ) {
      throw new ForbiddenException('Only instructors and admins can create course calendar events');
    }

    const event = await this.calendarRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      allDay: dto.allDay ?? false,
      color: dto.color ?? null,
      referenceId: dto.referenceId ?? null,
      referenceType: dto.referenceType ?? null,
      creator: { connect: { id: userId } },
      ...(dto.courseId && { course: { connect: { id: dto.courseId } } }),
    });

    return this.map(event);
  }

  /** Updates an event. Only the creator or an admin may update. */
  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    user: AuthenticatedUser,
  ): Promise<CalendarEventResponseDto> {
    const event = await this.calendarRepository.findById(id);
    if (!event) throw new NotFoundException('Calendar event not found');

    if (event.userId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('You are not authorized to modify this event');
    }

    const updated = await this.calendarRepository.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      ...(dto.allDay !== undefined && { allDay: dto.allDay }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.referenceId !== undefined && { referenceId: dto.referenceId }),
      ...(dto.referenceType !== undefined && { referenceType: dto.referenceType }),
    });

    return this.map(updated);
  }

  /** Deletes an event. Only the creator or an admin may delete. */
  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    const event = await this.calendarRepository.findById(id);
    if (!event) throw new NotFoundException('Calendar event not found');

    if (event.userId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('You are not authorized to modify this event');
    }

    await this.calendarRepository.delete(id);
  }

  /**
   * Creates a system-generated calendar event for an assignment due date.
   * Intended to be called by LessonsService when an assignment is published.
   */
  async createFromAssignmentDue(params: {
    courseId: string;
    lessonId: string;
    title: string;
    dueDate: Date;
    creatorId: string;
  }): Promise<void> {
    await this.calendarRepository.create({
      title: params.title,
      type: CalendarEventType.ASSIGNMENT_DUE,
      startDate: params.dueDate,
      allDay: false,
      referenceId: params.lessonId,
      referenceType: 'lesson',
      description: null,
      endDate: null,
      color: null,
      creator: { connect: { id: params.creatorId } },
      course: { connect: { id: params.courseId } },
    });
  }

  private map(event: CalendarEvent): CalendarEventResponseDto {
    return {
      id: event.id,
      courseId: event.courseId,
      userId: event.userId,
      title: event.title,
      description: event.description,
      type: event.type,
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay,
      color: event.color,
      referenceId: event.referenceId,
      referenceType: event.referenceType,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
