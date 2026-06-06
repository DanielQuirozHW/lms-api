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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@ApiTags('Announcements')
@Controller('courses')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post(':courseId/announcements')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an announcement (course instructor or admin)' })
  @ApiResponse({ status: 201, type: AnnouncementResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementsService.create(user, courseId, dto);
  }

  @Get(':courseId/announcements')
  @Public()
  @ApiOperation({ summary: 'List announcements for a course' })
  @ApiResponse({ status: 200, description: 'Paginated announcements list' })
  findMany(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('courseId') courseId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResult<AnnouncementResponseDto>> {
    return this.announcementsService.findMany(user, courseId, pagination);
  }

  @Patch(':courseId/announcements/:id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an announcement (author or admin)' })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ): Promise<AnnouncementResponseDto> {
    return this.announcementsService.update(user, courseId, id, dto);
  }

  @Delete(':courseId/announcements/:id')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an announcement (author or admin)' })
  @ApiResponse({ status: 204 })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.announcementsService.delete(user, courseId, id);
  }
}
