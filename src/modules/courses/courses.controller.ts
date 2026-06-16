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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseQueryDto } from './dto/course-query.dto';
import { CourseDetailResponseDto, CourseResponseDto } from './dto/course-response.dto';
import { CourseSettingsResponseDto } from './dto/course-settings-response.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateCourseSettingsDto } from './dto/update-course-settings.dto';
import { CourseOwnerGuard } from './guards/course-owner.guard';
import { CoursesService } from './courses.service';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course (starts as DRAFT)' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — instructor or admin role required' })
  @ApiResponse({ status: 409, description: 'Slug conflict — duplicate title' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.create(user.id, dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List courses (paginated, filterable by status and category)' })
  @ApiResponse({ status: 200, type: CourseResponseDto, isArray: true })
  findAll(@Query() query: CourseQueryDto): Promise<PaginatedResult<CourseResponseDto>> {
    return this.coursesService.findAll(query);
  }

  @Get('my')
  @Roles(UserRole.INSTRUCTOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated instructor's own courses" })
  @ApiResponse({ status: 200, type: CourseResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — instructor role required' })
  findMyCourses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<CourseResponseDto>> {
    return this.coursesService.findMyCourses(user.id, pagination);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get course detail with lesson and enrollment counts' })
  @ApiResponse({ status: 200, type: CourseDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<CourseDetailResponseDto> {
    return this.coursesService.findOne(id, user);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duplicate a course as a new DRAFT (owner or admin only)' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  duplicate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseResponseDto> {
    return this.coursesService.duplicate(id, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update course fields (owner or admin only)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto): Promise<CourseResponseDto> {
    return this.coursesService.update(id, dto);
  }

  @Patch(':id/publish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a course (owner or admin only)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  publish(@Param('id') id: string): Promise<CourseResponseDto> {
    return this.coursesService.publish(id);
  }

  @Patch(':id/archive')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a course (owner or admin only)' })
  @ApiResponse({ status: 200, type: CourseResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  archive(@Param('id') id: string): Promise<CourseResponseDto> {
    return this.coursesService.archive(id);
  }

  @Patch(':id/settings')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update course settings (owner or admin only)' })
  @ApiResponse({ status: 200, type: CourseSettingsResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateCourseSettingsDto,
  ): Promise<CourseSettingsResponseDto> {
    return this.coursesService.updateSettings(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a course (owner or admin only, no active enrollments)' })
  @ApiResponse({ status: 204, description: 'Course deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 409, description: 'Course has active enrollments' })
  remove(@Param('id') id: string): Promise<void> {
    return this.coursesService.remove(id);
  }
}
