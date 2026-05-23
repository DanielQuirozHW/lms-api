import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { UploadCourseCoverDto } from './dto/upload-course-cover.dto';
import { UploadLessonVideoDto } from './dto/upload-lesson-video.dto';
import { UploadResponseDto, VideoUploadResponseDto } from './dto/upload-response.dto';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar (max 5MB — jpg/png/webp)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadAvatar(user, file);
  }

  @Post('course-cover')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload course cover image (max 5MB — jpg/png/webp)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'courseId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        courseId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadCourseCover(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadCourseCoverDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadCourseCover(user, dto, file);
  }

  @Post('lesson-video')
  @Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get a presigned upload URL for a lesson video (mp4/webm)' })
  @ApiResponse({ status: 201, type: VideoUploadResponseDto })
  uploadLessonVideo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadLessonVideoDto,
  ): Promise<VideoUploadResponseDto> {
    return this.uploadService.generateLessonVideoUploadUrl(user, dto);
  }

  @Post('assignment-file')
  @ApiOperation({
    summary: 'Upload an assignment submission file (max 50MB — pdf/docx/zip/jpg/png)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadAssignmentFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResponseDto> {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadAssignmentFile(user, file);
  }
}
