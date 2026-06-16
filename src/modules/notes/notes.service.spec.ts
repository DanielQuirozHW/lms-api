import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { LessonNote } from '@prisma/client';
import { NotesRepository } from './notes.repository';
import { NotesService } from './notes.service';

const mockNote: LessonNote = {
  id: 'note-123',
  userId: 'user-456',
  lessonId: 'lesson-789',
  content: 'Great explanation of closures.',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('NotesService', () => {
  let service: NotesService;
  let repo: jest.Mocked<Pick<NotesRepository, 'findByUserAndLesson' | 'upsert' | 'delete'>>;

  beforeEach(async () => {
    repo = {
      findByUserAndLesson: jest.fn().mockResolvedValue(mockNote),
      upsert: jest.fn().mockResolvedValue(mockNote),
      delete: jest.fn().mockResolvedValue(mockNote),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotesService, { provide: NotesRepository, useValue: repo }],
    }).compile();

    service = module.get<NotesService>(NotesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getNote', () => {
    it('returns the mapped note when it exists', async () => {
      const result = await service.getNote('user-456', 'lesson-789');
      expect(repo.findByUserAndLesson).toHaveBeenCalledWith('user-456', 'lesson-789');
      expect(result).not.toBeNull();
      expect(result).toMatchObject({ id: 'note-123', content: 'Great explanation of closures.' });
      expect(result).toHaveProperty('userId');
    });

    it('returns null when no note exists yet', async () => {
      repo.findByUserAndLesson.mockResolvedValue(null);
      const result = await service.getNote('user-456', 'lesson-789');
      expect(result).toBeNull();
    });
  });

  describe('upsertNote', () => {
    it('calls upsert with correct args and returns mapped note', async () => {
      const result = await service.upsertNote('user-456', 'lesson-789', {
        content: 'Updated note.',
      });
      expect(repo.upsert).toHaveBeenCalledWith('user-456', 'lesson-789', 'Updated note.');
      expect(result.id).toBe('note-123');
    });
  });

  describe('deleteNote', () => {
    it('deletes note when it exists', async () => {
      await service.deleteNote('user-456', 'lesson-789');
      expect(repo.findByUserAndLesson).toHaveBeenCalledWith('user-456', 'lesson-789');
      expect(repo.delete).toHaveBeenCalledWith('user-456', 'lesson-789');
    });

    it('throws NotFoundException when no note exists to delete', async () => {
      repo.findByUserAndLesson.mockResolvedValue(null);
      await expect(service.deleteNote('user-456', 'lesson-789')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
