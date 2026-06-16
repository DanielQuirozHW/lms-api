import { Injectable } from '@nestjs/common';
import type { CourseGroup, CourseGroupMember, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CourseGroupWithCount = CourseGroup & { _count: { members: number } };

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByCourseId(courseId: string): Promise<CourseGroupWithCount[]> {
    return this.prisma.courseGroup.findMany({
      where: { courseId, isActive: true },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByIdAndCourseId(id: string, courseId: string): Promise<CourseGroupWithCount | null> {
    return this.prisma.courseGroup.findFirst({
      where: { id, courseId, isActive: true },
      include: { _count: { select: { members: true } } },
    });
  }

  findUserGroupInCourse(userId: string, courseId: string): Promise<CourseGroupMember | null> {
    return this.prisma.courseGroupMember.findFirst({
      where: { userId, group: { courseId, isActive: true } },
    });
  }

  create(data: Prisma.CourseGroupCreateInput): Promise<CourseGroup> {
    return this.prisma.courseGroup.create({ data });
  }

  update(id: string, data: Prisma.CourseGroupUpdateInput): Promise<CourseGroup> {
    return this.prisma.courseGroup.update({ where: { id }, data });
  }

  /** Soft-deletes the group by setting isActive = false. */
  delete(id: string): Promise<CourseGroup> {
    return this.prisma.courseGroup.update({ where: { id }, data: { isActive: false } });
  }

  addMember(groupId: string, userId: string): Promise<CourseGroupMember> {
    return this.prisma.courseGroupMember.create({ data: { groupId, userId } });
  }

  removeMember(groupId: string, userId: string): Promise<void> {
    return this.prisma.courseGroupMember
      .delete({ where: { groupId_userId: { groupId, userId } } })
      .then(() => undefined);
  }
}
