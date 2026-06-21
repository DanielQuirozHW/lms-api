import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { ForumPost, ForumPostVote, ForumThread } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type {
  CourseForumSettings,
  ForumPostWithVotes,
  ForumThreadWithPosts,
} from './forum.repository';
import { ForumRepository } from './forum.repository';
import { ForumService } from './forum.service';

const now = new Date('2026-01-01');

const mockThread: ForumThread = {
  id: 'thread-1',
  title: 'Test Thread',
  courseId: null,
  authorId: 'user-1',
  isPinned: false,
  isClosed: false,
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
};

const mockPost: ForumPost = {
  id: 'post-1',
  threadId: 'thread-1',
  authorId: 'user-2',
  content: 'Post content',
  parentId: null,
  isAcceptedAnswer: false,
  isActive: true,
  createdBy: null,
  updatedBy: null,
  createdAt: now,
  updatedAt: now,
};

const mockPostWithVotes: ForumPostWithVotes = { ...mockPost, votes: [] };

const mockThreadWithPosts: ForumThreadWithPosts = { ...mockThread, posts: [] };

const mockCourseForumSettings: CourseForumSettings = {
  instructorId: 'instructor-1',
  settings: { forumEnabled: true, forumPublic: false },
};

const student: AuthenticatedUser = { id: 'user-1', email: 'u@test.com', roles: [UserRole.STUDENT] };
const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@test.com', roles: [UserRole.ADMIN] };

describe('ForumService', () => {
  let service: ForumService;
  let repo: jest.Mocked<
    Pick<
      ForumRepository,
      | 'findCourseForumSettings'
      | 'findThreads'
      | 'findThreadById'
      | 'findThreadByIdWithPosts'
      | 'createThread'
      | 'updateThread'
      | 'deleteThread'
      | 'countPosts'
      | 'findPostById'
      | 'createPost'
      | 'updatePost'
      | 'deletePost'
      | 'clearAcceptedAnswer'
      | 'setAcceptedAnswer'
      | 'findVote'
      | 'upsertVote'
      | 'deleteVote'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;
  let enrollmentsService: jest.Mocked<Pick<EnrollmentsService, 'isEnrolled'>>;

  beforeEach(async () => {
    repo = {
      findCourseForumSettings: jest.fn(),
      findThreads: jest.fn(),
      findThreadById: jest.fn(),
      findThreadByIdWithPosts: jest.fn(),
      createThread: jest.fn(),
      updateThread: jest.fn(),
      deleteThread: jest.fn(),
      countPosts: jest.fn(),
      findPostById: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
      clearAcceptedAnswer: jest.fn(),
      setAcceptedAnswer: jest.fn(),
      findVote: jest.fn(),
      upsertVote: jest.fn(),
      deleteVote: jest.fn(),
    };
    coursesService = { findOne: jest.fn() };
    enrollmentsService = { isEnrolled: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: ForumRepository, useValue: repo },
        { provide: CoursesService, useValue: coursesService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
      ],
    }).compile();

    service = module.get(ForumService);
  });

  describe('createThread', () => {
    it('should create a global thread successfully', async () => {
      repo.createThread.mockResolvedValue(mockThread);

      const result = await service.createThread(student, { title: 'Test Thread' });

      expect(result.id).toBe('thread-1');
      expect(result.courseId).toBeNull();
      expect(repo.findCourseForumSettings).not.toHaveBeenCalled();
    });

    it('should create a course thread when user is enrolled', async () => {
      const courseThread = { ...mockThread, courseId: 'course-1' };
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      repo.createThread.mockResolvedValue(courseThread);

      const result = await service.createThread(student, {
        title: 'Test Thread',
        courseId: 'course-1',
      });

      expect(result.courseId).toBe('course-1');
    });

    it('should throw ForbiddenException when user is not enrolled in private course forum', async () => {
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(false);

      await expect(
        service.createThread(student, { title: 'Test Thread', courseId: 'course-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow unauthenticated read of public course forum thread list', async () => {
      const publicSettings: CourseForumSettings = {
        instructorId: 'instructor-1',
        settings: { forumEnabled: true, forumPublic: true },
      };
      repo.findCourseForumSettings.mockResolvedValue(publicSettings);
      repo.findThreads.mockResolvedValue([[{ ...mockThread, _count: { posts: 0 }, posts: [] }], 1]);

      const result = await service.findThreads(undefined, {
        courseId: 'course-1',
        page: 1,
        limit: 20,
        get skip() {
          return 0;
        },
      });

      expect(result.data).toHaveLength(1);
      expect(enrollmentsService.isEnrolled).not.toHaveBeenCalled();
    });
  });

  describe('createPost', () => {
    it('should create a post in an open thread', async () => {
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.createPost.mockResolvedValue(mockPostWithVotes);

      const result = await service.createPost('thread-1', student, { content: 'Hello' });

      expect(result.id).toBe('post-1');
      expect(result.voteScore).toBe(0);
    });

    it('should throw ForbiddenException when posting in a closed thread', async () => {
      repo.findThreadById.mockResolvedValue({ ...mockThread, isClosed: true });

      await expect(service.createPost('thread-1', student, { content: 'Hello' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('vote', () => {
    it('should add a new vote when none exists', async () => {
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.findPostById.mockResolvedValue(mockPost);
      repo.findVote.mockResolvedValue(null);

      await service.vote('thread-1', 'post-1', student, { value: 1 });

      expect(repo.upsertVote).toHaveBeenCalledWith('post-1', 'user-1', 1);
      expect(repo.deleteVote).not.toHaveBeenCalled();
    });

    it('should remove vote when same value is cast again (toggle)', async () => {
      const existingVote: ForumPostVote = {
        id: 'vote-1',
        postId: 'post-1',
        userId: 'user-1',
        value: 1,
        createdBy: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.findPostById.mockResolvedValue(mockPost);
      repo.findVote.mockResolvedValue(existingVote);

      await service.vote('thread-1', 'post-1', student, { value: 1 });

      expect(repo.deleteVote).toHaveBeenCalledWith('post-1', 'user-1');
      expect(repo.upsertVote).not.toHaveBeenCalled();
    });

    it('should change vote when different value is cast', async () => {
      const existingVote: ForumPostVote = {
        id: 'vote-1',
        postId: 'post-1',
        userId: 'user-1',
        value: 1,
        createdBy: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.findPostById.mockResolvedValue(mockPost);
      repo.findVote.mockResolvedValue(existingVote);

      await service.vote('thread-1', 'post-1', student, { value: -1 });

      expect(repo.upsertVote).toHaveBeenCalledWith('post-1', 'user-1', -1);
      expect(repo.deleteVote).not.toHaveBeenCalled();
    });
  });

  describe('acceptAnswer', () => {
    it('should accept an answer and clear previous accepted answer', async () => {
      const acceptedPost: ForumPostWithVotes = { ...mockPostWithVotes, isAcceptedAnswer: true };
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.findPostById.mockResolvedValue(mockPost);
      repo.clearAcceptedAnswer.mockResolvedValue(undefined);
      repo.setAcceptedAnswer.mockResolvedValue(acceptedPost);

      const result = await service.acceptAnswer('thread-1', 'post-1', { ...student, id: 'user-1' });

      expect(repo.clearAcceptedAnswer).toHaveBeenCalledWith('thread-1');
      expect(repo.setAcceptedAnswer).toHaveBeenCalledWith('post-1', true);
      expect(result.isAcceptedAnswer).toBe(true);
    });

    it('should unmark accepted answer when toggled (post was already accepted)', async () => {
      const acceptedPost: ForumPost = { ...mockPost, isAcceptedAnswer: true };
      const unansweredPost: ForumPostWithVotes = { ...mockPostWithVotes, isAcceptedAnswer: false };
      repo.findThreadById.mockResolvedValue({ ...mockThread, authorId: 'user-1' });
      repo.findPostById.mockResolvedValue(acceptedPost);
      repo.clearAcceptedAnswer.mockResolvedValue(undefined);
      repo.setAcceptedAnswer.mockResolvedValue(unansweredPost);

      const result = await service.acceptAnswer('thread-1', 'post-1', student);

      expect(repo.setAcceptedAnswer).toHaveBeenCalledWith('post-1', false);
      expect(result.isAcceptedAnswer).toBe(false);
    });

    it('should throw ForbiddenException when user is not thread author or instructor or admin', async () => {
      const otherUser: AuthenticatedUser = {
        id: 'other-user',
        email: 'o@test.com',
        roles: [UserRole.STUDENT],
      };
      repo.findThreadById.mockResolvedValue({ ...mockThread, authorId: 'user-1', courseId: null });
      repo.findPostById.mockResolvedValue(mockPost);

      await expect(service.acceptAnswer('thread-1', 'post-1', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteThread', () => {
    it('should delete a thread with 0 posts (author)', async () => {
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.countPosts.mockResolvedValue(0);
      repo.deleteThread.mockResolvedValue(undefined);

      await expect(service.deleteThread('thread-1', student)).resolves.toBeUndefined();
      expect(repo.deleteThread).toHaveBeenCalledWith('thread-1');
    });

    it('should throw ConflictException when non-admin tries to delete thread with >1 post', async () => {
      repo.findThreadById.mockResolvedValue(mockThread);
      repo.countPosts.mockResolvedValue(3);

      await expect(service.deleteThread('thread-1', student)).rejects.toThrow(ConflictException);
    });

    it('should allow admin to delete thread with many posts', async () => {
      repo.findThreadById.mockResolvedValue({ ...mockThread, authorId: 'admin-1' });
      repo.deleteThread.mockResolvedValue(undefined);

      await expect(service.deleteThread('thread-1', admin)).resolves.toBeUndefined();
      expect(repo.countPosts).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when thread does not exist', async () => {
      repo.findThreadById.mockResolvedValue(null);

      await expect(service.deleteThread('thread-1', student)).rejects.toThrow(NotFoundException);
    });
  });

  describe('private forum access control', () => {
    it('should deny unauthenticated access to private course forum', async () => {
      repo.findThreadByIdWithPosts.mockResolvedValue({
        ...mockThreadWithPosts,
        courseId: 'course-1',
      });
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);

      await expect(service.findThread('thread-1', undefined)).rejects.toThrow(ForbiddenException);
    });

    it('should deny unenrolled user access to private course forum', async () => {
      repo.findThreadByIdWithPosts.mockResolvedValue({
        ...mockThreadWithPosts,
        courseId: 'course-1',
      });
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(false);

      await expect(service.findThread('thread-1', student)).rejects.toThrow(ForbiddenException);
    });

    it('should allow enrolled user to access private course forum', async () => {
      const courseThread: ForumThreadWithPosts = {
        ...mockThreadWithPosts,
        courseId: 'course-1',
      };
      repo.findThreadByIdWithPosts.mockResolvedValue(courseThread);
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);
      enrollmentsService.isEnrolled.mockResolvedValue(true);

      const result = await service.findThread('thread-1', student);

      expect(result.courseId).toBe('course-1');
    });

    it('should allow admin to access private course forum without enrollment', async () => {
      const courseThread: ForumThreadWithPosts = {
        ...mockThreadWithPosts,
        courseId: 'course-1',
      };
      repo.findThreadByIdWithPosts.mockResolvedValue(courseThread);
      repo.findCourseForumSettings.mockResolvedValue(mockCourseForumSettings);

      const result = await service.findThread('thread-1', admin);

      expect(result.courseId).toBe('course-1');
      expect(enrollmentsService.isEnrolled).not.toHaveBeenCalled();
    });
  });
});
