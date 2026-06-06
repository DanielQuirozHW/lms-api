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
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupMemberResponseDto, GroupResponseDto } from './dto/group-response.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('courses/:courseId/groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({ summary: 'List all groups for a course' })
  @ApiResponse({
    status: 200,
    type: GroupResponseDto,
    isArray: true,
    description: 'List of groups',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Course not visible to caller' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  findAll(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GroupResponseDto[]> {
    return this.groupsService.findAll(courseId, user);
  }

  @Post()
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new group for a course (owner or admin only)' })
  @ApiResponse({ status: 201, type: GroupResponseDto, description: 'Group created' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  @ApiResponse({ status: 409, description: 'Group name already exists in this course' })
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(courseId, dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a group (owner or admin only)' })
  @ApiResponse({ status: 200, type: GroupResponseDto, description: 'Group updated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course or group not found' })
  update(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(courseId, id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a group (owner or admin only, must have no members)' })
  @ApiResponse({ status: 204, description: 'Group deleted' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course or group not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete group with members' })
  delete(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.groupsService.delete(courseId, id, user);
  }

  @Post(':id/members')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a member to a group (owner or admin only)' })
  @ApiResponse({ status: 201, type: GroupMemberResponseDto, description: 'Member added' })
  @ApiResponse({ status: 400, description: 'User is not enrolled in this course' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course or group not found' })
  @ApiResponse({ status: 409, description: 'User already in a group or group is full' })
  addMember(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GroupMemberResponseDto> {
    return this.groupsService.addMember(courseId, id, dto, user);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member from a group (owner or admin only)' })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  @ApiResponse({ status: 403, description: 'Forbidden — must be course owner or admin' })
  @ApiResponse({ status: 404, description: 'Course, group, or member not found' })
  removeMember(
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.groupsService.removeMember(courseId, id, userId, user);
  }
}
