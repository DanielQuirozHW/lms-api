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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateGradebookCategoryDto } from './dto/create-gradebook-category.dto';
import { CreateGradebookItemDto } from './dto/create-gradebook-item.dto';
import { UpdateGradebookCategoryDto } from './dto/update-gradebook-category.dto';
import {
  GradebookCategoryResponseDto,
  GradebookItemResponseDto,
  GradebookResponseDto,
  StudentGradeResponseDto,
} from './dto/gradebook-response.dto';
import { GradebookService } from './gradebook.service';

@ApiTags('Gradebook')
@ApiBearerAuth()
@Controller('courses/:courseId/gradebook')
export class GradebookController {
  constructor(private readonly gradebookService: GradebookService) {}

  @Get()
  @ApiOperation({ summary: 'Get the full gradebook structure for a course' })
  @ApiResponse({ status: 200, type: GradebookResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findStructure(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GradebookResponseDto> {
    return this.gradebookService.findStructure(courseId, user);
  }

  @Post('categories')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new gradebook category for a course' })
  @ApiResponse({ status: 201, type: GradebookCategoryResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  createCategory(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateGradebookCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GradebookCategoryResponseDto> {
    return this.gradebookService.createCategory(courseId, dto, user);
  }

  @Post('items')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a lesson as a gradebook item under a category' })
  @ApiResponse({ status: 201, type: GradebookItemResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course or category not found' })
  createItem(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateGradebookItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GradebookItemResponseDto> {
    return this.gradebookService.createItem(courseId, dto, user);
  }

  @Get('student/:enrollmentId')
  @ApiOperation({ summary: "Get a student's calculated grade for this course" })
  @ApiResponse({ status: 200, type: StudentGradeResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — can only view your own grade unless instructor/admin',
  })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  getStudentGrade(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StudentGradeResponseDto> {
    return this.gradebookService.getStudentGrade(courseId, enrollmentId, user);
  }

  @Patch('categories/:id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a gradebook category' })
  @ApiResponse({ status: 200, type: GradebookCategoryResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Category or course not found' })
  updateCategory(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradebookCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GradebookCategoryResponseDto> {
    return this.gradebookService.updateCategory(courseId, id, dto, user);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a gradebook category (must have no items)' })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Category or course not found' })
  @ApiResponse({ status: 409, description: 'Category still has items' })
  deleteCategory(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.gradebookService.deleteCategory(courseId, id, user);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a gradebook item' })
  @ApiResponse({ status: 204, description: 'Item deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Item or course not found' })
  deleteItem(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.gradebookService.deleteItem(courseId, id, user);
  }
}
