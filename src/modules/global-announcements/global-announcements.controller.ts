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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CreateGlobalAnnouncementDto } from './dto/create-global-announcement.dto';
import { GlobalAnnouncementResponseDto } from './dto/global-announcement-response.dto';
import { UpdateGlobalAnnouncementDto } from './dto/update-global-announcement.dto';
import { GlobalAnnouncementsService } from './global-announcements.service';

@ApiTags('GlobalAnnouncements')
@Controller('announcements/global')
export class GlobalAnnouncementsController {
  constructor(private readonly service: GlobalAnnouncementsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active platform-wide announcements' })
  @ApiResponse({ status: 200, type: [GlobalAnnouncementResponseDto] })
  findActive(): Promise<GlobalAnnouncementResponseDto[]> {
    return this.service.findActive();
  }

  @Post()
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a platform-wide announcement (admin only)' })
  @ApiResponse({ status: 201, type: GlobalAnnouncementResponseDto })
  create(
    @Body() dto: CreateGlobalAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GlobalAnnouncementResponseDto> {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a platform-wide announcement (admin only)' })
  @ApiResponse({ status: 200, type: GlobalAnnouncementResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GlobalAnnouncementResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a platform-wide announcement (admin only)' })
  @ApiResponse({ status: 204 })
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.service.delete(id, user);
  }
}
