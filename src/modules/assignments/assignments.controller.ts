import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentSettingsDto } from './dto/create-assignment-settings.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import {
  AssignmentSettingsResponseDto,
  SubmissionResponseDto,
} from './dto/assignment-response.dto';

@ApiTags('Assignments')
@Controller('lessons/:lessonId/assignment')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('settings')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create or update assignment settings for a lesson' })
  @ApiResponse({ status: 200, type: AssignmentSettingsResponseDto })
  upsertSettings(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateAssignmentSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignmentSettingsResponseDto> {
    return this.assignmentsService.upsertSettings(lessonId, dto, user);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get assignment settings for a lesson' })
  @ApiResponse({ status: 200, type: AssignmentSettingsResponseDto })
  getSettings(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignmentSettingsResponseDto> {
    return this.assignmentsService.getSettings(lessonId, user);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit an assignment (enrolled student)' })
  @ApiResponse({ status: 201, type: SubmissionResponseDto })
  submit(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: SubmitAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.assignmentsService.submit(lessonId, dto, user);
  }

  @Get('submissions')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all submissions for a lesson (instructor/admin)' })
  @ApiResponse({ status: 200, type: [SubmissionResponseDto] })
  getSubmissions(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    return this.assignmentsService.getSubmissions(lessonId, user);
  }

  // Declared BEFORE :submissionId to prevent NestJS treating 'pending' as a UUID param
  @Get('submissions/pending')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get ungraded submissions (instructor/admin)' })
  @ApiResponse({ status: 200, type: [SubmissionResponseDto] })
  getPendingSubmissions(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    return this.assignmentsService.getPendingSubmissions(lessonId, user);
  }

  // Declared BEFORE :submissionId to prevent NestJS treating 'mine' as a UUID param
  @Get('submissions/mine')
  @ApiOperation({ summary: "Get the calling student's own submissions" })
  @ApiResponse({ status: 200, type: [SubmissionResponseDto] })
  getMySubmissions(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto[]> {
    return this.assignmentsService.getMySubmissions(lessonId, user);
  }

  @Get('submissions/:submissionId')
  @ApiOperation({ summary: 'Get a single submission' })
  @ApiResponse({ status: 200, type: SubmissionResponseDto })
  getSubmission(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.assignmentsService.getSubmission(lessonId, submissionId, user);
  }

  @Patch('submissions/:submissionId/grade')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grade a submission (instructor/admin)' })
  @ApiResponse({ status: 200, type: SubmissionResponseDto })
  gradeSubmission(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: GradeSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmissionResponseDto> {
    return this.assignmentsService.gradeSubmission(lessonId, submissionId, dto, user);
  }
}
