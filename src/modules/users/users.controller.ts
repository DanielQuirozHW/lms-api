import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { type PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { LastActiveLessonResponseDto } from './dto/last-active-lesson-response.dto';
import { LoginEventResponseDto } from './dto/login-event-response.dto';
import { OverallProgressResponseDto } from './dto/overall-progress-response.dto';
import { StreakResponseDto } from './dto/streak-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserPrivateResponseDto, UserPublicResponseDto } from './dto/user-response.dto';
import { WeeklyActivityResponseDto } from './dto/weekly-activity-response.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserPrivateResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserPrivateResponseDto> {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserPrivateResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserPrivateResponseDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  @ApiResponse({ status: 204, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Permanently delete own account' })
  @ApiResponse({ status: 204, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Password is incorrect' })
  deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    return this.usersService.deleteAccount(user.id, dto);
  }

  @Get('me/stats/weekly-activity')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get last 7 days of lesson completion activity' })
  @ApiResponse({ status: 200, type: WeeklyActivityResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getWeeklyActivity(@CurrentUser() user: AuthenticatedUser): Promise<WeeklyActivityResponseDto> {
    return this.usersService.getWeeklyActivity(user.id);
  }

  @Get('me/login-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get last 10 login events for the current user' })
  @ApiResponse({ status: 200, type: LoginEventResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getLoginHistory(@CurrentUser() user: AuthenticatedUser): Promise<LoginEventResponseDto[]> {
    return this.usersService.getLoginHistory(user.id);
  }

  @Get('me/stats/streak')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current and longest lesson completion streaks' })
  @ApiResponse({ status: 200, type: StreakResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getStreak(@CurrentUser() user: AuthenticatedUser): Promise<StreakResponseDto> {
    return this.usersService.getStreak(user.id);
  }

  @Get('me/stats/last-active-lesson')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the most recently watched lesson across all enrollments' })
  @ApiResponse({ status: 200, type: LastActiveLessonResponseDto, nullable: true })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getLastActiveLesson(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LastActiveLessonResponseDto | null> {
    return this.usersService.getLastActiveLesson(user.id);
  }

  @Get('me/stats/overall-progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get aggregate progress across all active enrollments' })
  @ApiResponse({ status: 200, type: OverallProgressResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  getOverallProgress(@CurrentUser() user: AuthenticatedUser): Promise<OverallProgressResponseDto> {
    return this.usersService.getOverallProgress(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin only, paginated)' })
  @ApiResponse({ status: 200, type: UserPrivateResponseDto, isArray: true })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getAllUsers(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<UserPrivateResponseDto>> {
    return this.usersService.getAllUsers(pagination);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiResponse({ status: 200, type: UserPrivateResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Cannot assign ADMIN role, demote yourself, or demote the last admin',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserPrivateResponseDto> {
    return this.usersService.updateRole(id, dto.role, user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get public profile of any user' })
  @ApiResponse({ status: 200, type: UserPublicResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  getPublicProfile(@Param('id') id: string): Promise<UserPublicResponseDto> {
    return this.usersService.getPublicProfile(id);
  }
}
