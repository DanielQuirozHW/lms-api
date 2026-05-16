import { Injectable } from '@nestjs/common';
import type { ForumPost, ForumThread } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindThreadsParams {
  courseId?: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class ForumRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findThreads(params: FindThreadsParams): Promise<[ForumThread[], number]> {
    const where = params.courseId ? { courseId: params.courseId } : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.forumThread.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.forumThread.count({ where }),
    ]);
    return [data, total];
  }

  findThreadById(id: string): Promise<ForumThread | null> {
    return this.prisma.forumThread.findUnique({ where: { id } });
  }

  createThread(data: { title: string; authorId: string; courseId?: string }): Promise<ForumThread> {
    return this.prisma.forumThread.create({ data });
  }

  findPostsByThread(threadId: string): Promise<ForumPost[]> {
    return this.prisma.forumPost.findMany({
      where: { threadId, parentId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  findPostById(id: string): Promise<ForumPost | null> {
    return this.prisma.forumPost.findUnique({ where: { id } });
  }

  createPost(data: {
    threadId: string;
    authorId: string;
    content: string;
    parentId?: string;
  }): Promise<ForumPost> {
    return this.prisma.forumPost.create({ data });
  }
}
