import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateEnrollmentCodeDto } from './dto/create-enrollment-code.dto';
import { EnrollmentCodeResponseDto } from './dto/enrollment-code-response.dto';
import { EnrollmentCodesService } from './enrollment-codes.service';

@ApiTags('Enrollment Codes')
@ApiBearerAuth()
@Controller('courses/:courseId/enrollment-codes')
export class EnrollmentCodesController {
  constructor(private readonly enrollmentCodesService: EnrollmentCodesService) {}

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an enrollment code for a course' })
  @ApiResponse({ status: 201, type: EnrollmentCodeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  create(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEnrollmentCodeDto,
  ): Promise<EnrollmentCodeResponseDto> {
    return this.enrollmentCodesService.create(courseId, user, dto);
  }

  @Get()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'List all enrollment codes for a course' })
  @ApiResponse({ status: 200, type: EnrollmentCodeResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnrollmentCodeResponseDto[]> {
    return this.enrollmentCodesService.findByCourse(courseId, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate an enrollment code (soft delete)' })
  @ApiResponse({ status: 204, description: 'Code deactivated' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  deactivate(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.enrollmentCodesService.deactivate(courseId, id, user);
  }
}
