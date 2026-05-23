import { Injectable } from '@nestjs/common';
import type { CalendarEvent, Prisma } from '@prisma/client';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CalendarQueryDto } from './dto/calendar-query.dto';

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(
    userId: string,
    enrolledCourseIds: string[],
    query: CalendarQueryDto,
  ): Promise<CalendarEvent[]> {
    const dateFilter: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    };
    const hasDateFilter = query.startDate !== undefined || query.endDate !== undefined;

    return this.prisma.calendarEvent.findMany({
      where: {
        AND: [
          {
            OR: [{ courseId: null, userId }, { courseId: { in: enrolledCourseIds } }],
          },
          hasDateFilter ? { startDate: dateFilter } : {},
          query.type ? { type: query.type } : {},
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findByCourseId(courseId: string, query: CalendarQueryDto): Promise<CalendarEvent[]> {
    const dateFilter: Prisma.DateTimeFilter = {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    };
    const hasDateFilter = query.startDate !== undefined || query.endDate !== undefined;

    return this.prisma.calendarEvent.findMany({
      where: {
        courseId,
        ...(hasDateFilter ? { startDate: dateFilter } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findById(id: string): Promise<CalendarEvent | null> {
    return this.prisma.calendarEvent.findUnique({ where: { id } });
  }

  /** Returns all active enrolled course IDs for a given user. */
  async findEnrolledCourseIds(userId: string): Promise<string[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: EnrollmentStatus.ACTIVE },
      select: { courseId: true },
    });
    return enrollments.map((e) => e.courseId);
  }

  create(data: Prisma.CalendarEventCreateInput): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.create({ data });
  }

  update(id: string, data: Prisma.CalendarEventUpdateInput): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.update({ where: { id }, data });
  }

  delete(id: string): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
