import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { type PaginatedResult } from '../../common/dto/pagination.dto';
import { UserEnrollmentQueryDto } from './dto/user-enrollment-query.dto';
import { UserEnrollmentItemDto } from './dto/user-enrollment-response.dto';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('User Assignments')
@ApiBearerAuth()
@Controller('users/:userId/enrollments')
export class UserEnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get enrollments for a user — own data or admin' })
  @ApiResponse({ status: 200, type: UserEnrollmentItemDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Access denied' })
  getUserEnrollments(
    @Param('userId') userId: string,
    @Query() query: UserEnrollmentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<UserEnrollmentItemDto>> {
    return this.enrollmentsService.getUserEnrollments(userId, user, query);
  }

  @Delete(':courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a user from a course — admin only' })
  @ApiResponse({ status: 204, description: 'Enrollment removed' })
  @ApiResponse({ status: 403, description: 'Admin only' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  @ApiResponse({ status: 409, description: 'Cannot remove a completed enrollment' })
  removeUserEnrollment(
    @Param('userId') userId: string,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    return this.enrollmentsService.removeUserEnrollment(userId, courseId);
  }
}
