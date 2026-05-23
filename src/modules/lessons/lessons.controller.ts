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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateResourceDto } from './dto/create-resource.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  LessonDetailResponseDto,
  LessonProgressResponseDto,
  LessonResourceDto,
  LessonResponseDto,
} from './dto/lesson-response.dto';
import { ReorderLessonsDto } from './dto/reorder-lessons.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { LessonOwnerGuard } from './guards/lesson-owner.guard';
import { LessonsService } from './lessons.service';

@ApiTags('Lessons')
@Controller('courses/:courseId/modules/:moduleId/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a lesson in a module (owner or admin only)' })
  @ApiResponse({ status: 201, type: LessonResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course or module not found' })
  @ApiResponse({ status: 409, description: 'Order conflict — duplicate position' })
  create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.create(courseId, moduleId, dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List lessons in a module (students see only published)' })
  @ApiResponse({ status: 200, type: LessonResponseDto, isArray: true })
  findAll(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<LessonResponseDto[]> {
    const publishedOnly =
      !user || !user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
    return this.lessonsService.findAll(courseId, moduleId, publishedOnly);
  }

  @Patch('reorder')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder lessons in a module (owner or admin only)' })
  @ApiResponse({ status: 200, description: 'Lessons reordered successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  reorder(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: ReorderLessonsDto,
  ): Promise<void> {
    return this.lessonsService.reorder(moduleId, dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get lesson detail with resources and settings' })
  @ApiResponse({ status: 200, type: LessonDetailResponseDto })
  @ApiResponse({ status: 403, description: 'Not enrolled in this course' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  findOne(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<LessonDetailResponseDto> {
    return this.lessonsService.findOne(id, moduleId, courseId, user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a lesson (owner or admin only)' })
  @ApiResponse({ status: 200, type: LessonResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  update(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.update(courseId, moduleId, id, dto);
  }

  @Patch(':id/publish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a lesson (owner or admin only)' })
  @ApiResponse({ status: 200, type: LessonResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  publish(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.publish(courseId, moduleId, id);
  }

  @Patch(':id/progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update lesson progress (enrolled students only)' })
  @ApiResponse({ status: 200, type: LessonProgressResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Not enrolled in this course' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  updateProgress(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LessonProgressResponseDto> {
    return this.lessonsService.updateProgress(courseId, moduleId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a lesson (owner or admin only, no student progress)' })
  @ApiResponse({ status: 204, description: 'Lesson deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  @ApiResponse({ status: 409, description: 'Lesson has student progress records' })
  remove(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.lessonsService.remove(courseId, moduleId, id);
  }

  @Post(':id/resources')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a resource to a lesson (owner or admin only)' })
  @ApiResponse({ status: 201, type: LessonResourceDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Lesson not found' })
  addResource(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateResourceDto,
  ): Promise<LessonResourceDto> {
    return this.lessonsService.addResource(courseId, moduleId, id, dto);
  }

  @Delete(':id/resources/:resourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(LessonOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a resource from a lesson (owner or admin only)' })
  @ApiResponse({ status: 204, description: 'Resource removed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  removeResource(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('moduleId', ParseUUIDPipe) _moduleId: string,
    @Param('id', ParseUUIDPipe) lessonId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ): Promise<void> {
    return this.lessonsService.removeResource(lessonId, resourceId);
  }
}
