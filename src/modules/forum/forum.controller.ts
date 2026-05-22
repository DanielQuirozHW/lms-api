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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { ThreadQueryDto } from './dto/thread-query.dto';
import { ThreadDetailResponseDto, ThreadResponseDto } from './dto/thread-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { VoteDto } from './dto/vote.dto';
import { ForumService } from './forum.service';

@ApiTags('Forum')
@ApiBearerAuth()
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // ── Threads ──────────────────────────────────────────────────────────────

  @Post('threads')
  @ApiOperation({ summary: 'Create a new thread' })
  @ApiResponse({ status: 201, type: ThreadResponseDto })
  @ApiResponse({ status: 400, description: 'Forum disabled for this course' })
  @ApiResponse({ status: 403, description: 'Not enrolled or not authenticated' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadDto,
  ): Promise<ThreadResponseDto> {
    return this.forumService.createThread(user, dto);
  }

  @Get('threads')
  @Public()
  @ApiOperation({ summary: 'List threads (paginated, optional courseId filter)' })
  @ApiResponse({ status: 200, type: ThreadResponseDto, isArray: true })
  findThreads(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ThreadQueryDto,
  ): Promise<PaginatedResult<ThreadResponseDto>> {
    return this.forumService.findThreads(user, query);
  }

  @Get('threads/:id')
  @Public()
  @ApiOperation({ summary: 'Get thread detail with posts' })
  @ApiResponse({ status: 200, type: ThreadDetailResponseDto })
  @ApiResponse({ status: 403, description: 'Private forum — not enrolled' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  findThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<ThreadDetailResponseDto> {
    return this.forumService.findThread(id, user);
  }

  @Patch('threads/:id')
  @ApiOperation({ summary: 'Update thread title (author or admin)' })
  @ApiResponse({ status: 200, type: ThreadResponseDto })
  @ApiResponse({ status: 403, description: 'Not the thread author' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  updateThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateThreadDto,
  ): Promise<ThreadResponseDto> {
    return this.forumService.updateThread(id, user, dto);
  }

  @Patch('threads/:id/pin')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Toggle thread pin (instructor or admin)' })
  @ApiResponse({ status: 200, type: ThreadResponseDto })
  @ApiResponse({ status: 403, description: 'Not course instructor or admin' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  pinThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ThreadResponseDto> {
    return this.forumService.pinThread(id, user);
  }

  @Patch('threads/:id/close')
  @Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
  @ApiOperation({ summary: 'Toggle thread open/closed (instructor or admin)' })
  @ApiResponse({ status: 200, type: ThreadResponseDto })
  @ApiResponse({ status: 403, description: 'Not course instructor or admin' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  closeThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ThreadResponseDto> {
    return this.forumService.closeThread(id, user);
  }

  @Delete('threads/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete thread (author or admin; admin bypasses post-count guard)' })
  @ApiResponse({ status: 204, description: 'Thread deleted' })
  @ApiResponse({ status: 403, description: 'Not the thread author' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  @ApiResponse({ status: 409, description: 'Thread has replies from other users' })
  deleteThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.forumService.deleteThread(id, user);
  }

  // ── Posts ────────────────────────────────────────────────────────────────

  @Post('threads/:threadId/posts')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a post in a thread' })
  @ApiResponse({ status: 201, type: PostResponseDto })
  @ApiResponse({ status: 403, description: 'Thread is closed or forum access denied' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  createPost(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.forumService.createPost(threadId, user, dto);
  }

  @Patch('threads/:threadId/posts/:id')
  @ApiOperation({ summary: 'Update post content (author only)' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 403, description: 'Not the post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  updatePost(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.forumService.updatePost(threadId, id, user, dto);
  }

  @Patch('threads/:threadId/posts/:id/accept')
  @ApiOperation({ summary: 'Toggle accepted answer (thread author, instructor, or admin)' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient permission' })
  @ApiResponse({ status: 404, description: 'Post or thread not found' })
  acceptAnswer(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostResponseDto> {
    return this.forumService.acceptAnswer(threadId, id, user);
  }

  @Post('threads/:threadId/posts/:id/vote')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Upvote or downvote a post (same value twice removes the vote)' })
  @ApiResponse({ status: 204, description: 'Vote recorded or removed' })
  @ApiResponse({ status: 404, description: 'Post or thread not found' })
  vote(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoteDto,
  ): Promise<void> {
    return this.forumService.vote(threadId, id, user, dto);
  }

  @Delete('threads/:threadId/posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a post (author or admin)' })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 403, description: 'Not the post author' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  deletePost(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.forumService.deletePost(threadId, id, user);
  }
}
