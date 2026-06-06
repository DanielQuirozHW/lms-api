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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateRubricAssessmentDto } from './dto/create-rubric-assessment.dto';
import { CreateRubricDto } from './dto/create-rubric.dto';
import {
  RubricAssessmentResponseDto,
  RubricResponseDto,
  RubricSummaryResponseDto,
} from './dto/rubric-response.dto';
import { UpdateRubricDto } from './dto/update-rubric.dto';
import { RubricsService } from './rubrics.service';

@ApiTags('Rubrics')
@ApiBearerAuth()
@Controller('courses/:courseId/rubrics')
export class RubricsController {
  constructor(private readonly rubricsService: RubricsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rubrics for a course' })
  @ApiResponse({ status: 200, type: RubricSummaryResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricSummaryResponseDto[]> {
    return this.rubricsService.findAll(courseId, user);
  }

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a rubric with criteria and levels (owner or admin only)' })
  @ApiResponse({ status: 201, type: RubricResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateRubricDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricResponseDto> {
    return this.rubricsService.create(courseId, dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rubric with full criteria and levels' })
  @ApiResponse({ status: 200, type: RubricResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  findOne(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricResponseDto> {
    return this.rubricsService.findOne(courseId, id, user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update rubric title, description, or totalPoints (owner or admin only)',
  })
  @ApiResponse({ status: 200, type: RubricResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRubricDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricResponseDto> {
    return this.rubricsService.update(courseId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a rubric (owner or admin only, no existing assessments)' })
  @ApiResponse({ status: 204, description: 'Rubric deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  @ApiResponse({ status: 409, description: 'Rubric has existing assessments' })
  delete(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.rubricsService.delete(courseId, id, user);
  }

  @Post(':id/assess/:submissionId')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a rubric assessment for a submission (owner or admin only)' })
  @ApiResponse({ status: 201, type: RubricAssessmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Rubric or submission not found' })
  createAssessment(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: CreateRubricAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricAssessmentResponseDto> {
    return this.rubricsService.createAssessment(courseId, id, submissionId, dto, user);
  }

  @Get(':id/assess/:submissionId')
  @ApiOperation({ summary: 'Get the rubric assessment for a submission' })
  @ApiResponse({ status: 200, type: RubricAssessmentResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  getAssessment(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RubricAssessmentResponseDto> {
    return this.rubricsService.getAssessment(courseId, id, submissionId, user);
  }
}
