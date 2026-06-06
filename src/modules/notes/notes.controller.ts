import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { NoteResponseDto, UpsertNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

@ApiTags('Notes')
@ApiBearerAuth()
@Controller('lessons/:lessonId/notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's note for a lesson" })
  @ApiResponse({
    status: 200,
    type: NoteResponseDto,
    description: 'Note, or null if none exists yet',
  })
  getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<NoteResponseDto | null> {
    return this.notesService.getNote(user.id, lessonId);
  }

  @Put()
  @ApiOperation({ summary: "Create or update the current user's note for a lesson" })
  @ApiResponse({ status: 200, type: NoteResponseDto })
  upsertNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertNoteDto,
  ): Promise<NoteResponseDto> {
    return this.notesService.upsertNote(user.id, lessonId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete the current user's note for a lesson" })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Note not found' })
  deleteNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<void> {
    return this.notesService.deleteNote(user.id, lessonId);
  }
}
