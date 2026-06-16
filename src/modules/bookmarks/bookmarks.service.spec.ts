import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { LessonBookmark } from '@prisma/client';
import type { BookmarkWithLesson } from './bookmarks.repository';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';

const rawBookmark: LessonBookmark = {
  id: 'bm-123',
  userId: 'user-456',
  lessonId: 'lesson-789',
  isActive: true,
  createdAt: new Date('2024-01-01'),
};

const mockBookmarkWithLesson: BookmarkWithLesson = {
  ...rawBookmark,
  lesson: {
    id: 'lesson-789',
    title: 'Intro to TypeScript',
    type: 'VIDEO',
    moduleId: 'module-111',
    module: {
      courseId: 'course-222',
      course: { id: 'course-222', title: 'TypeScript Basics' },
    },
  },
};

describe('BookmarksService', () => {
  let service: BookmarksService;
  let repo: jest.Mocked<
    Pick<
      BookmarksRepository,
      'findByUser' | 'countByUser' | 'findByUserAndLesson' | 'createWithDetails' | 'delete'
    >
  >;

  beforeEach(async () => {
    repo = {
      findByUser: jest.fn().mockResolvedValue([mockBookmarkWithLesson]),
      countByUser: jest.fn().mockResolvedValue(1),
      findByUserAndLesson: jest.fn().mockResolvedValue(rawBookmark),
      createWithDetails: jest.fn().mockResolvedValue(mockBookmarkWithLesson),
      delete: jest.fn().mockResolvedValue(rawBookmark),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BookmarksService, { provide: BookmarksRepository, useValue: repo }],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('returns paginated bookmarks with lesson details', async () => {
      const result = await service.findAll('user-456', { page: 1, limit: 20, skip: 0 });
      expect(repo.findByUser).toHaveBeenCalledWith('user-456', 0, 20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].lesson.title).toBe('Intro to TypeScript');
      expect(result.data[0].lesson.course?.title).toBe('TypeScript Basics');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('create', () => {
    it('creates a bookmark and returns it with lesson details', async () => {
      const result = await service.create('user-456', 'lesson-789');
      expect(repo.createWithDetails).toHaveBeenCalledWith('user-456', 'lesson-789');
      expect(result.id).toBe('bm-123');
      expect(result.lesson.title).toBe('Intro to TypeScript');
      expect(result.lesson.course?.title).toBe('TypeScript Basics');
      expect(result.userId).toBe('user-456');
    });
  });

  describe('check', () => {
    it('returns bookmarked: true when bookmark exists', async () => {
      const result = await service.check('user-456', 'lesson-789');
      expect(result).toEqual({ isBookmarked: true });
    });

    it('returns bookmarked: false when no bookmark exists', async () => {
      repo.findByUserAndLesson.mockResolvedValue(null);
      const result = await service.check('user-456', 'lesson-789');
      expect(result).toEqual({ isBookmarked: false });
    });
  });

  describe('delete', () => {
    it('deletes the bookmark when it exists', async () => {
      await service.delete('user-456', 'lesson-789');
      expect(repo.findByUserAndLesson).toHaveBeenCalledWith('user-456', 'lesson-789');
      expect(repo.delete).toHaveBeenCalledWith('user-456', 'lesson-789');
    });

    it('throws NotFoundException when bookmark does not exist', async () => {
      repo.findByUserAndLesson.mockResolvedValue(null);
      await expect(service.delete('user-456', 'lesson-789')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
