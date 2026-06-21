import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CourseGroupMember } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { AddMemberDto } from './dto/add-member.dto';
import type { CreateGroupDto } from './dto/create-group.dto';
import type { GroupMemberResponseDto, GroupResponseDto } from './dto/group-response.dto';
import type { UpdateGroupDto } from './dto/update-group.dto';
import { type CourseGroupWithCount, GroupsRepository } from './groups.repository';

@Injectable()
export class GroupsService {
  constructor(
    private readonly groupsRepository: GroupsRepository,
    private readonly coursesService: CoursesService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /** Returns all groups for the given course. Visibility is gated by coursesService (DRAFT/ARCHIVED only visible to owner/admin). */
  async findAll(courseId: string, user: AuthenticatedUser): Promise<GroupResponseDto[]> {
    await this.coursesService.findOne(courseId, user);
    const groups = await this.groupsRepository.findByCourseId(courseId);
    return groups.map((g) => this.map(g));
  }

  /** Creates a new group for a course. Caller must be the course owner or an admin. */
  async create(
    courseId: string,
    dto: CreateGroupDto,
    user: AuthenticatedUser,
  ): Promise<GroupResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const group = await this.groupsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      maxMembers: dto.maxMembers ?? null,
      course: { connect: { id: courseId } },
    });

    return this.map({ ...group, _count: { members: 0 } });
  }

  /** Updates a group. Caller must be the course owner or an admin. */
  async update(
    courseId: string,
    id: string,
    dto: UpdateGroupDto,
    user: AuthenticatedUser,
  ): Promise<GroupResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const existing = await this.groupsRepository.findByIdAndCourseId(id, courseId);
    if (!existing) throw new NotFoundException('Group not found');

    const updated = await this.groupsRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.maxMembers !== undefined && { maxMembers: dto.maxMembers }),
    });

    return this.map({ ...updated, _count: existing._count });
  }

  /** Deletes a group. Caller must be the course owner or an admin. Throws 409 if the group has members. */
  async delete(courseId: string, id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const group = await this.groupsRepository.findByIdAndCourseId(id, courseId);
    if (!group) throw new NotFoundException('Group not found');

    if (group._count.members > 0) {
      throw new ConflictException('Cannot delete group with members');
    }

    await this.groupsRepository.delete(id);
  }

  /** Adds a user to a group. Caller must be the course owner or admin. User must be enrolled and not already in another group for this course. */
  async addMember(
    courseId: string,
    id: string,
    dto: AddMemberDto,
    user: AuthenticatedUser,
  ): Promise<GroupMemberResponseDto> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const group = await this.groupsRepository.findByIdAndCourseId(id, courseId);
    if (!group) throw new NotFoundException('Group not found');

    const enrolled = await this.enrollmentsService.isEnrolled(dto.userId, courseId);
    if (!enrolled) {
      throw new BadRequestException('User is not enrolled in this course');
    }

    const existingMembership = await this.groupsRepository.findUserGroupInCourse(
      dto.userId,
      courseId,
    );
    if (existingMembership) {
      throw new ConflictException('User is already in a group for this course');
    }

    if (group.maxMembers !== null && group._count.members >= group.maxMembers) {
      throw new ConflictException('Group is full');
    }

    const member = await this.groupsRepository.addMember(id, dto.userId);
    return this.mapMember(member);
  }

  /** Removes a user from a group. Caller must be the course owner or an admin. */
  async removeMember(
    courseId: string,
    id: string,
    targetUserId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const course = await this.coursesService.findOne(courseId, user);
    this.verifyOwnership(course, user);

    const group = await this.groupsRepository.findByIdAndCourseId(id, courseId);
    if (!group) throw new NotFoundException('Group not found');

    await this.groupsRepository.removeMember(id, targetUserId);
  }

  private verifyOwnership(course: CourseDetailResponseDto, user: AuthenticatedUser): void {
    if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }
  }

  private map(group: CourseGroupWithCount): GroupResponseDto {
    return {
      id: group.id,
      courseId: group.courseId,
      name: group.name,
      description: group.description,
      maxMembers: group.maxMembers,
      memberCount: group._count.members,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private mapMember(member: CourseGroupMember): GroupMemberResponseDto {
    return {
      id: member.id,
      groupId: member.groupId,
      userId: member.userId,
      joinedAt: member.createdAt,
    };
  }
}
