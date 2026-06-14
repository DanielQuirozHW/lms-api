import { Injectable, NotFoundException } from '@nestjs/common';
import type { LessonNote } from '@prisma/client';
import type { NoteResponseDto, UpsertNoteDto } from './dto/note.dto';
import { NotesRepository } from './notes.repository';

@Injectable()
export class NotesService {
  constructor(private readonly notesRepository: NotesRepository) {}

  /** Returns the current user's note for the given lesson, or null if none exists yet. */
  async getNote(userId: string, lessonId: string): Promise<NoteResponseDto | null> {
    const note = await this.notesRepository.findByUserAndLesson(userId, lessonId);
    if (!note) return null;
    return this.map(note);
  }

  /** Creates or updates the current user's note for the given lesson. */
  async upsertNote(userId: string, lessonId: string, dto: UpsertNoteDto): Promise<NoteResponseDto> {
    const note = await this.notesRepository.upsert(userId, lessonId, dto.content);
    return this.map(note);
  }

  /** Deletes the current user's note for the given lesson. Throws 404 if no note exists. */
  async deleteNote(userId: string, lessonId: string): Promise<void> {
    const existing = await this.notesRepository.findByUserAndLesson(userId, lessonId);
    if (!existing) throw new NotFoundException('Note not found');
    await this.notesRepository.delete(userId, lessonId);
  }

  private map(note: LessonNote): NoteResponseDto {
    return {
      id: note.id,
      lessonId: note.lessonId,
      userId: note.userId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
