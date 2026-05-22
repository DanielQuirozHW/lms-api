import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ForumThread } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { CreatePostDto } from './dto/create-post.dto';
import type { CreateThreadDto } from './dto/create-thread.dto';
import type { PostResponseDto } from './dto/post-response.dto';
import type { ThreadQueryDto } from './dto/thread-query.dto';
import type { ThreadDetailResponseDto, ThreadResponseDto } from './dto/thread-response.dto';
import type { UpdatePostDto } from './dto/update-post.dto';
import type { UpdateThreadDto } from './dto/update-thread.dto';
import type { VoteDto } from './dto/vote.dto';
import {
  type ForumPostWithVotes,
  type ForumThreadWithMeta,
  type ForumThreadWithPosts,
  ForumRepository,
} from './forum.repository';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private readonly forumRepository: ForumRepository,
    private readonly coursesService: CoursesService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  // ── Threads ──────────────────────────────────────────────────────────────

  async createThread(user: AuthenticatedUser, dto: CreateThreadDto): Promise<ThreadResponseDto> {
    await this.assertForumAccess(dto.courseId, user);
    const thread = await this.forumRepository.createThread({
      title: dto.title,
      authorId: user.id,
      courseId: dto.courseId,
    });
    return this.mapThreadMeta({ ...thread, _count: { posts: 0 }, posts: [] });
  }

  async findThreads(
    user: AuthenticatedUser | undefined,
    query: ThreadQueryDto,
  ): Promise<PaginatedResult<ThreadResponseDto>> {
    if (query.courseId) await this.assertForumAccess(query.courseId, user);
    const [threads, total] = await this.forumRepository.findThreads(query, query.courseId);
    return paginate(
      threads.map((t) => this.mapThreadMeta(t)),
      total,
      query,
    );
  }

  async findThread(
    id: string,
    user: AuthenticatedUser | undefined,
  ): Promise<ThreadDetailResponseDto> {
    const thread = await this.forumRepository.findThreadByIdWithPosts(id);
    if (!thread) throw new NotFoundException('Thread not found');
    await this.assertForumAccess(thread.courseId, user);
    return this.mapThreadDetail(thread);
  }

  async updateThread(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateThreadDto,
  ): Promise<ThreadResponseDto> {
    const thread = await this.getThreadOrFail(id);
    await this.assertForumAccess(thread.courseId, user);
    this.assertAuthorAccess(thread, user);
    const updated = await this.forumRepository.updateThread(id, { title: dto.title });
    const postCount = await this.forumRepository.countPosts(id);
    return this.mapThreadMeta({ ...updated, _count: { posts: postCount }, posts: [] });
  }

  async pinThread(id: string, user: AuthenticatedUser): Promise<ThreadResponseDto> {
    const thread = await this.getThreadOrFail(id);
    await this.assertModeratorAccess(thread, user);
    const updated = await this.forumRepository.updateThread(id, { isPinned: !thread.isPinned });
    const postCount = await this.forumRepository.countPosts(id);
    return this.mapThreadMeta({ ...updated, _count: { posts: postCount }, posts: [] });
  }

  async closeThread(id: string, user: AuthenticatedUser): Promise<ThreadResponseDto> {
    const thread = await this.getThreadOrFail(id);
    await this.assertModeratorAccess(thread, user);
    const updated = await this.forumRepository.updateThread(id, { isClosed: !thread.isClosed });
    const postCount = await this.forumRepository.countPosts(id);
    return this.mapThreadMeta({ ...updated, _count: { posts: postCount }, posts: [] });
  }

  async deleteThread(id: string, user: AuthenticatedUser): Promise<void> {
    const thread = await this.getThreadOrFail(id);
    await this.assertForumAccess(thread.courseId, user);
    this.assertAuthorAccess(thread, user);

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin) {
      const postCount = await this.forumRepository.countPosts(id);
      if (postCount > 1) {
        throw new ConflictException('Cannot delete a thread that has replies from other users');
      }
    }

    await this.forumRepository.deleteThread(id);
  }

  // ── Posts ────────────────────────────────────────────────────────────────

  async createPost(
    threadId: string,
    user: AuthenticatedUser,
    dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const thread = await this.getThreadOrFail(threadId);
    await this.assertForumAccess(thread.courseId, user);

    if (thread.isClosed) {
      throw new ForbiddenException('Cannot post in a closed thread');
    }

    const post = await this.forumRepository.createPost({
      threadId,
      authorId: user.id,
      content: dto.content,
      parentId: dto.parentId,
    });
    return this.mapPost(post);
  }

  async updatePost(
    threadId: string,
    postId: string,
    user: AuthenticatedUser,
    dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    const post = await this.forumRepository.findPostById(postId);
    if (!post || post.threadId !== threadId) throw new NotFoundException('Post not found');

    if (post.authorId !== user.id) {
      throw new ForbiddenException('You are not the author of this post');
    }

    const updated = await this.forumRepository.updatePost(postId, { content: dto.content });
    return this.mapPost(updated);
  }

  async acceptAnswer(
    threadId: string,
    postId: string,
    user: AuthenticatedUser,
  ): Promise<PostResponseDto> {
    const thread = await this.getThreadOrFail(threadId);
    await this.assertForumAccess(thread.courseId, user);

    const post = await this.forumRepository.findPostById(postId);
    if (!post || post.threadId !== threadId) throw new NotFoundException('Post not found');

    const canAccept =
      user.roles.includes(UserRole.ADMIN) ||
      thread.authorId === user.id ||
      (thread.courseId !== null && (await this.isInstructor(thread.courseId, user.id)));

    if (!canAccept) {
      throw new ForbiddenException(
        'Only the thread author, course instructor, or admin can accept answers',
      );
    }

    const toggling = post.isAcceptedAnswer;
    await this.forumRepository.clearAcceptedAnswer(threadId);
    const updated = await this.forumRepository.setAcceptedAnswer(postId, !toggling);
    return this.mapPost(updated);
  }

  async vote(
    threadId: string,
    postId: string,
    user: AuthenticatedUser,
    dto: VoteDto,
  ): Promise<void> {
    const thread = await this.getThreadOrFail(threadId);
    await this.assertForumAccess(thread.courseId, user);

    const post = await this.forumRepository.findPostById(postId);
    if (!post || post.threadId !== threadId) throw new NotFoundException('Post not found');

    const existing = await this.forumRepository.findVote(postId, user.id);
    if (existing?.value === dto.value) {
      await this.forumRepository.deleteVote(postId, user.id);
    } else {
      await this.forumRepository.upsertVote(postId, user.id, dto.value);
    }
  }

  async deletePost(threadId: string, postId: string, user: AuthenticatedUser): Promise<void> {
    const post = await this.forumRepository.findPostById(postId);
    if (!post || post.threadId !== threadId) throw new NotFoundException('Post not found');

    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isAdmin && post.authorId !== user.id) {
      throw new ForbiddenException('You are not the author of this post');
    }

    await this.forumRepository.deletePost(postId);
  }

  // ── Access helpers ────────────────────────────────────────────────────────

  private async assertForumAccess(
    courseId: string | null | undefined,
    user: AuthenticatedUser | undefined,
  ): Promise<void> {
    if (!courseId) {
      if (!user) {
        throw new ForbiddenException('Authentication required to access global forum threads');
      }
      return;
    }

    const course = await this.forumRepository.findCourseForumSettings(courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (course.settings && !course.settings.forumEnabled) {
      throw new BadRequestException('Forum is disabled for this course');
    }

    if (course.settings?.forumPublic) return;

    if (!user) throw new ForbiddenException('Authentication required to access this forum');
    if (user.roles.includes(UserRole.ADMIN)) return;
    if (course.instructorId === user.id) return;

    const enrolled = await this.enrollmentsService.isEnrolled(user.id, courseId);
    if (!enrolled) {
      this.logger.warn(
        `Forbidden forum access: user ${user.id} not enrolled in course ${courseId}`,
      );
      throw new ForbiddenException('You must be enrolled in this course to access this forum');
    }
  }

  private async assertModeratorAccess(thread: ForumThread, user: AuthenticatedUser): Promise<void> {
    if (user.roles.includes(UserRole.ADMIN)) return;

    if (!thread.courseId) {
      throw new ForbiddenException('Only admins can moderate global threads');
    }

    const course = await this.coursesService.findOne(thread.courseId);
    if (course.instructorId === user.id) return;

    throw new ForbiddenException('Only the course instructor or admin can perform this action');
  }

  private assertAuthorAccess(thread: ForumThread, user: AuthenticatedUser): void {
    if (user.roles.includes(UserRole.ADMIN)) return;
    if (thread.authorId !== user.id) {
      throw new ForbiddenException('You are not the author of this thread');
    }
  }

  private async isInstructor(courseId: string, userId: string): Promise<boolean> {
    const course = await this.coursesService.findOne(courseId);
    return course.instructorId === userId;
  }

  private async getThreadOrFail(id: string): Promise<ForumThread> {
    const thread = await this.forumRepository.findThreadById(id);
    if (!thread) throw new NotFoundException('Thread not found');
    return thread;
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private mapThreadMeta(thread: ForumThreadWithMeta): ThreadResponseDto {
    return {
      id: thread.id,
      title: thread.title,
      authorId: thread.authorId,
      courseId: thread.courseId,
      isPinned: thread.isPinned,
      isClosed: thread.isClosed,
      postCount: thread._count.posts,
      lastActivityAt: thread.posts[0]?.createdAt ?? thread.createdAt,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  private mapThreadDetail(thread: ForumThreadWithPosts): ThreadDetailResponseDto {
    const posts = thread.posts.map((p) => this.mapPost(p));
    const lastPost = thread.posts.at(-1);
    return {
      id: thread.id,
      title: thread.title,
      authorId: thread.authorId,
      courseId: thread.courseId,
      isPinned: thread.isPinned,
      isClosed: thread.isClosed,
      postCount: thread.posts.length,
      lastActivityAt: lastPost?.createdAt ?? thread.createdAt,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      posts,
    };
  }

  private mapPost(post: ForumPostWithVotes): PostResponseDto {
    const voteScore = post.votes.reduce((sum, v) => sum + v.value, 0);
    return {
      id: post.id,
      threadId: post.threadId,
      authorId: post.authorId,
      content: post.content,
      parentId: post.parentId,
      isAcceptedAnswer: post.isAcceptedAnswer,
      voteScore,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
