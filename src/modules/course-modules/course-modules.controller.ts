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
import { CourseModulesService } from './course-modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { ModuleDetailResponseDto, ModuleResponseDto } from './dto/module-response.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CourseModuleOwnerGuard } from './guards/course-module-owner.guard';

@ApiTags('Course Modules')
@Controller('courses/:courseId/modules')
export class CourseModulesController {
  constructor(private readonly courseModulesService: CourseModulesService) {}

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseModuleOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a module in a course (owner or admin only)' })
  @ApiResponse({ status: 201, type: ModuleResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 409, description: 'Order conflict — duplicate position' })
  create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateModuleDto,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.create(courseId, dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List modules of a course (students see only published)' })
  @ApiResponse({ status: 200, type: ModuleResponseDto, isArray: true })
  findAll(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ModuleResponseDto[]> {
    const publishedOnly =
      !user || !user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
    return this.courseModulesService.findAll(courseId, publishedOnly);
  }

  @Patch('reorder')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseModuleOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder modules in a course (owner or admin only)' })
  @ApiResponse({ status: 200, description: 'Modules reordered successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  reorder(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Body() dto: ReorderModulesDto,
  ): Promise<void> {
    return this.courseModulesService.reorder(dto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get module detail with lessons (students see only published lessons)' })
  @ApiResponse({ status: 200, type: ModuleDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Module not found' })
  findOne(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ModuleDetailResponseDto> {
    const publishedOnly =
      !user || !user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
    return this.courseModulesService.findOne(id, publishedOnly);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseModuleOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a module (owner or admin only)' })
  @ApiResponse({ status: 200, type: ModuleResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  update(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuleDto,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.update(id, dto);
  }

  @Patch(':id/publish')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseModuleOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a module (owner or admin only)' })
  @ApiResponse({ status: 200, type: ModuleResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  publish(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.publish(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @UseGuards(CourseModuleOwnerGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a module (owner or admin only, no published lessons)' })
  @ApiResponse({ status: 204, description: 'Module deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiResponse({ status: 409, description: 'Module has published lessons' })
  remove(
    @Param('courseId', ParseUUIDPipe) _courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.courseModulesService.remove(id);
  }
}
