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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateQuizSettingsDto } from './dto/create-quiz-settings.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import {
  AttemptResultDto,
  AttemptSummaryDto,
  QuestionResponseDto,
  QuizSettingsResponseDto,
} from './dto/quiz-response.dto';
import { QuizService } from './quiz.service';

@ApiTags('Quiz')
@Controller('lessons/:lessonId/quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('settings')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create or update quiz settings for a lesson' })
  @ApiResponse({ status: 200, type: QuizSettingsResponseDto })
  upsertSettings(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateQuizSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizSettingsResponseDto> {
    return this.quizService.upsertSettings(lessonId, dto, user);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get quiz settings for a lesson' })
  @ApiResponse({ status: 200, type: QuizSettingsResponseDto })
  getSettings(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuizSettingsResponseDto> {
    return this.quizService.getSettings(lessonId, user);
  }

  @Post('questions')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a question to the quiz' })
  @ApiResponse({ status: 201, type: QuestionResponseDto })
  addQuestion(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuestionResponseDto> {
    return this.quizService.addQuestion(lessonId, dto, user);
  }

  @Get('questions')
  @ApiOperation({
    summary: 'List questions — students see shuffled without isCorrect until attempt complete',
  })
  @ApiResponse({ status: 200, type: [QuestionResponseDto] })
  listQuestions(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuestionResponseDto[]> {
    return this.quizService.listQuestions(lessonId, user);
  }

  @Patch('questions/:id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a question' })
  @ApiResponse({ status: 200, type: QuestionResponseDto })
  updateQuestion(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuestionResponseDto> {
    return this.quizService.updateQuestion(lessonId, id, dto, user);
  }

  @Delete('questions/:id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a question' })
  @ApiResponse({ status: 204 })
  deleteQuestion(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.quizService.deleteQuestion(lessonId, id, user);
  }

  @Post('attempts')
  @ApiOperation({ summary: 'Start a new quiz attempt (enrolled student)' })
  @ApiResponse({ status: 201, type: AttemptSummaryDto })
  startAttempt(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttemptSummaryDto> {
    return this.quizService.startAttempt(lessonId, user);
  }

  @Get('attempts')
  @ApiOperation({ summary: "Get the authenticated student's own attempts" })
  @ApiResponse({ status: 200, type: [AttemptSummaryDto] })
  getMyAttempts(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttemptSummaryDto[]> {
    return this.quizService.getMyAttempts(lessonId, user);
  }

  // Must be declared BEFORE :attemptId to avoid NestJS treating 'all' as an attemptId param
  @Get('attempts/all')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: "Get all students' attempts (instructor/admin)" })
  @ApiResponse({ status: 200, type: [AttemptSummaryDto] })
  getAllAttempts(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttemptSummaryDto[]> {
    return this.quizService.getAllAttempts(lessonId, user);
  }

  @Post('attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit answers for an in-progress attempt and auto-grade' })
  @ApiResponse({ status: 201, type: AttemptResultDto })
  submitAttempt(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SubmitAnswersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttemptResultDto> {
    return this.quizService.submitAttempt(lessonId, attemptId, dto, user);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Get a specific attempt with answers and results' })
  @ApiResponse({ status: 200, type: AttemptResultDto })
  getAttempt(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttemptResultDto> {
    return this.quizService.getAttempt(lessonId, attemptId, user);
  }
}
