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
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
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
    @Param('courseId') courseId: string,
    @Body() dto: CreateModuleDto,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.create(courseId, dto);
  }

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List modules of a course (students see only published)' })
  @ApiResponse({ status: 200, type: ModuleDetailResponseDto, isArray: true })
  findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ModuleDetailResponseDto[]> {
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
  reorder(@Param('courseId') courseId: string, @Body() dto: ReorderModulesDto): Promise<void> {
    return this.courseModulesService.reorder(courseId, dto);
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get module detail with lessons (students see only published lessons)' })
  @ApiResponse({ status: 200, type: ModuleDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Module not found' })
  findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ModuleDetailResponseDto> {
    const publishedOnly =
      !user || !user.roles.some((r) => r === UserRole.INSTRUCTOR || r === UserRole.ADMIN);
    return this.courseModulesService.findOne(courseId, id, publishedOnly);
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
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.update(courseId, id, dto);
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
    @Param('courseId') courseId: string,
    @Param('id') id: string,
  ): Promise<ModuleResponseDto> {
    return this.courseModulesService.publish(courseId, id);
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
  remove(@Param('courseId') courseId: string, @Param('id') id: string): Promise<void> {
    return this.courseModulesService.remove(courseId, id);
  }
}
