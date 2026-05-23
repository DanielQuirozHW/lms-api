import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CalendarService } from './calendar.service';
import { CalendarEventResponseDto } from './dto/calendar-event-response.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller()
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('calendar')
  @ApiOperation({ summary: 'Create a personal or course calendar event' })
  @ApiResponse({ status: 201, type: CalendarEventResponseDto, description: 'Event created' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Non-instructor attempting to create a course event' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    return this.calendarService.create(user.id, dto, user);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get events for the current user (personal + enrolled courses)' })
  @ApiResponse({
    status: 200,
    type: CalendarEventResponseDto,
    isArray: true,
    description: 'List of events',
  })
  findMyEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    return this.calendarService.findEventsForUser(user.id, query);
  }

  @Get('courses/:courseId/calendar')
  @ApiOperation({ summary: 'Get calendar events for a specific course' })
  @ApiResponse({
    status: 200,
    type: CalendarEventResponseDto,
    isArray: true,
    description: 'List of course events',
  })
  @ApiResponse({ status: 404, description: 'Course not found or not accessible' })
  findCourseEvents(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarQueryDto,
  ): Promise<CalendarEventResponseDto[]> {
    return this.calendarService.findCourseEvents(courseId, user, query);
  }

  @Patch('calendar/:id')
  @ApiOperation({ summary: 'Update a calendar event (creator or admin only)' })
  @ApiResponse({ status: 200, type: CalendarEventResponseDto, description: 'Event updated' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the creator or admin' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventResponseDto> {
    return this.calendarService.update(id, dto, user);
  }

  @Delete('calendar/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a calendar event (creator or admin only)' })
  @ApiResponse({ status: 204, description: 'Event deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the creator or admin' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.calendarService.delete(id, user);
  }
}
