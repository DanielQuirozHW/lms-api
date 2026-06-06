import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { BookmarksService } from './bookmarks.service';
import {
  BookmarkResponseDto,
  CheckBookmarkResponseDto,
  CreateBookmarkDto,
} from './dto/bookmark.dto';

@ApiTags('Bookmarks')
@ApiBearerAuth()
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  @ApiOperation({ summary: 'List all bookmarked lessons for the current user (paginated)' })
  @ApiResponse({ status: 200, type: [BookmarkResponseDto] })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<BookmarkResponseDto>> {
    return this.bookmarksService.findAll(user.id, pagination);
  }

  // NOTE: ':lessonId/check' is declared before ':lessonId' (used by DELETE) to
  // ensure NestJS routes the literal segment 'check' correctly.
  @Get(':lessonId/check')
  @ApiOperation({ summary: 'Check whether a lesson is bookmarked by the current user' })
  @ApiResponse({ status: 200, type: CheckBookmarkResponseDto })
  check(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<CheckBookmarkResponseDto> {
    return this.bookmarksService.check(user.id, lessonId);
  }

  @Post()
  @ApiOperation({ summary: 'Bookmark a lesson' })
  @ApiResponse({ status: 201, type: BookmarkResponseDto })
  @ApiResponse({ status: 409, description: 'Lesson already bookmarked' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    return this.bookmarksService.create(user.id, dto.lessonId);
  }

  @Delete(':lessonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a bookmark by lessonId' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Bookmark not found' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<void> {
    return this.bookmarksService.delete(user.id, lessonId);
  }
}
