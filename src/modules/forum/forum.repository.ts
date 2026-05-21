import { Injectable } from '@nestjs/common';
import type { ForumPost, ForumPostVote, ForumThread } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationDto } from '../../common/dto/pagination.dto';

export type CourseForumSettings = {
  instructorId: string;
  settings: { forumEnabled: boolean; forumPublic: boolean } | null;
};

export type ForumThreadWithMeta = ForumThread & {
  _count: { posts: number };
  posts: Pick<ForumPost, 'createdAt'>[];
};

export type ForumPostWithVotes = ForumPost & { votes: ForumPostVote[] };

export type ForumThreadWithPosts = ForumThread & { posts: ForumPostWithVotes[] };

@Injectable()
export class ForumRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Course / access helpers ──────────────────────────────────────────────

  findCourseForumSettings(courseId: string): Promise<CourseForumSettings | null> {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        instructorId: true,
        settings: { select: { forumEnabled: true, forumPublic: true } },
      },
    });
  }

  // ── Threads ──────────────────────────────────────────────────────────────

  async findThreads(
    pagination: PaginationDto,
    courseId?: string,
  ): Promise<[ForumThreadWithMeta[], number]> {
    const where = courseId ? { courseId } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.forumThread.findMany({
        where,
        include: {
          _count: { select: { posts: true } },
          posts: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit ?? 20,
      }),
      this.prisma.forumThread.count({ where }),
    ]);
    return [data, total];
  }

  findThreadById(id: string): Promise<ForumThread | null> {
    return this.prisma.forumThread.findUnique({ where: { id } });
  }

  findThreadByIdWithPosts(id: string): Promise<ForumThreadWithPosts | null> {
    return this.prisma.forumThread.findUnique({
      where: { id },
      include: { posts: { include: { votes: true }, orderBy: { createdAt: 'asc' } } },
    });
  }

  createThread(data: { title: string; authorId: string; courseId?: string }): Promise<ForumThread> {
    return this.prisma.forumThread.create({ data });
  }

  updateThread(
    id: string,
    data: { title?: string; isPinned?: boolean; isClosed?: boolean },
  ): Promise<ForumThread> {
    return this.prisma.forumThread.update({ where: { id }, data });
  }

  async deleteThread(id: string): Promise<void> {
    await this.prisma.forumThread.delete({ where: { id } });
  }

  countPosts(threadId: string): Promise<number> {
    return this.prisma.forumPost.count({ where: { threadId } });
  }

  // ── Posts ────────────────────────────────────────────────────────────────

  findPostById(id: string): Promise<ForumPost | null> {
    return this.prisma.forumPost.findUnique({ where: { id } });
  }

  createPost(data: {
    threadId: string;
    authorId: string;
    content: string;
    parentId?: string;
  }): Promise<ForumPostWithVotes> {
    return this.prisma.forumPost.create({
      data,
      include: { votes: true },
    });
  }

  updatePost(id: string, data: { content: string }): Promise<ForumPostWithVotes> {
    return this.prisma.forumPost.update({
      where: { id },
      data,
      include: { votes: true },
    });
  }

  async deletePost(id: string): Promise<void> {
    await this.prisma.forumPost.delete({ where: { id } });
  }

  async clearAcceptedAnswer(threadId: string): Promise<void> {
    await this.prisma.forumPost.updateMany({
      where: { threadId, isAcceptedAnswer: true },
      data: { isAcceptedAnswer: false },
    });
  }

  setAcceptedAnswer(postId: string, value: boolean): Promise<ForumPostWithVotes> {
    return this.prisma.forumPost.update({
      where: { id: postId },
      data: { isAcceptedAnswer: value },
      include: { votes: true },
    });
  }

  // ── Votes ────────────────────────────────────────────────────────────────

  findVote(postId: string, userId: string): Promise<ForumPostVote | null> {
    return this.prisma.forumPostVote.findUnique({
      where: { postId_userId: { postId, userId } },
    });
  }

  upsertVote(postId: string, userId: string, value: number): Promise<ForumPostVote> {
    return this.prisma.forumPostVote.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, value },
      update: { value },
    });
  }

  async deleteVote(postId: string, userId: string): Promise<void> {
    await this.prisma.forumPostVote.delete({ where: { postId_userId: { postId, userId } } });
  }
}
