import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentDetailResponseDto, EnrollmentResponseDto } from './dto/enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Enroll current user in a course' })
  @ApiResponse({ status: 201, type: EnrollmentResponseDto })
  @ApiResponse({ status: 400, description: 'Course not available or enrollment window closed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Email not verified or instructor self-enrollment' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 409, description: 'Already enrolled or course is full' })
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponseDto> {
    return this.enrollmentsService.enroll(user, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get current user's enrollments (paginated)" })
  @ApiResponse({ status: 200, type: EnrollmentResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  findMyEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<EnrollmentResponseDto>> {
    return this.enrollmentsService.findMyEnrollments(user.id, pagination);
  }

  @Get('course/:courseId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all enrollments for a course (owner or admin only)' })
  @ApiResponse({ status: 200, type: EnrollmentResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  getByCourseId(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<EnrollmentResponseDto>> {
    return this.enrollmentsService.getByCourseId(courseId, user, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment detail with progress summary' })
  @ApiResponse({ status: 200, type: EnrollmentDetailResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your enrollment' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnrollmentDetailResponseDto> {
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    return this.enrollmentsService.findOne(id, user.id, isAdmin);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel enrollment (student cancels own, admin cancels any)' })
  @ApiResponse({ status: 204, description: 'Enrollment cancelled' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your enrollment' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  @ApiResponse({ status: 409, description: 'Cannot cancel a completed enrollment' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    return this.enrollmentsService.cancel(id, user.id, isAdmin);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Manually mark an enrollment as completed (admin only)' })
  @ApiResponse({ status: 200, type: EnrollmentResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  @ApiResponse({ status: 409, description: 'Enrollment is not active' })
  complete(@Param('id', ParseUUIDPipe) id: string): Promise<EnrollmentResponseDto> {
    return this.enrollmentsService.complete(id);
  }
}
