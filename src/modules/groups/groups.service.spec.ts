import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { CourseGroup, CourseGroupMember } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CourseDetailResponseDto } from '../courses/dto/course-response.dto';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { CourseGroupWithCount } from './groups.repository';
import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

const mockCourseDetail: CourseDetailResponseDto = {
  id: 'course-123',
  title: 'TypeScript Basics',
  slug: 'typescript-basics',
  description: null,
  coverUrl: null,
  status: 'PUBLISHED',
  enrollmentType: 'FREE',
  price: null,
  instructorId: 'instructor-123',
  categoryId: null,
  enrollmentPeriodStart: null,
  enrollmentPeriodEnd: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  lessonsCount: 5,
  enrollmentsCount: 10,
};

const mockGroup: CourseGroup = {
  id: 'group-123',
  courseId: 'course-123',
  name: 'Team Alpha',
  description: null,
  maxMembers: 5,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockGroupWithCount: CourseGroupWithCount = {
  ...mockGroup,
  _count: { members: 2 },
};

const mockMember: CourseGroupMember = {
  id: 'member-123',
  groupId: 'group-123',
  userId: 'user-456',
  joinedAt: new Date('2024-01-01'),
};

const instructorUser: AuthenticatedUser = {
  id: 'instructor-123',
  email: 'instructor@test.com',
  roles: ['INSTRUCTOR'],
};

const adminUser: AuthenticatedUser = {
  id: 'admin-999',
  email: 'admin@test.com',
  roles: ['ADMIN'],
};

const otherUser: AuthenticatedUser = {
  id: 'other-456',
  email: 'other@test.com',
  roles: ['INSTRUCTOR'],
};

describe('GroupsService', () => {
  let service: GroupsService;
  let groupsRepository: jest.Mocked<
    Pick<
      GroupsRepository,
      | 'findByCourseId'
      | 'findByIdAndCourseId'
      | 'findUserGroupInCourse'
      | 'create'
      | 'update'
      | 'delete'
      | 'addMember'
      | 'removeMember'
    >
  >;
  let coursesService: jest.Mocked<Pick<CoursesService, 'findOne'>>;
  let enrollmentsService: jest.Mocked<Pick<EnrollmentsService, 'isEnrolled'>>;

  beforeEach(async () => {
    groupsRepository = {
      findByCourseId: jest.fn(),
      findByIdAndCourseId: jest.fn(),
      findUserGroupInCourse: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addMember: jest.fn(),
      removeMember: jest.fn(),
    };

    coursesService = {
      findOne: jest.fn(),
    };

    enrollmentsService = {
      isEnrolled: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: GroupsRepository, useValue: groupsRepository },
        { provide: CoursesService, useValue: coursesService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns mapped array of groups for the given course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByCourseId.mockResolvedValue([mockGroupWithCount]);

      const result = await service.findAll('course-123', instructorUser);

      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', instructorUser);
      expect(groupsRepository.findByCourseId).toHaveBeenCalledWith('course-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('group-123');
      expect(result[0].memberCount).toBe(2);
      expect(result[0]).not.toHaveProperty('_count');
    });

    it('returns empty array when no groups exist', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByCourseId.mockResolvedValue([]);

      const result = await service.findAll('course-123', instructorUser);

      expect(result).toEqual([]);
    });

    it('propagates NotFoundException when course is not visible', async () => {
      coursesService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findAll('course-123', instructorUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(groupsRepository.findByCourseId).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('verifies ownership and creates group, returning mapped result', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.create.mockResolvedValue(mockGroup);

      const result = await service.create(
        'course-123',
        { name: 'Team Alpha', maxMembers: 5 },
        instructorUser,
      );

      expect(coursesService.findOne).toHaveBeenCalledWith('course-123', instructorUser);
      expect(groupsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Team Alpha',
          maxMembers: 5,
          course: { connect: { id: 'course-123' } },
        }),
      );
      expect(result.id).toBe('group-123');
      expect(result.memberCount).toBe(0);
    });

    it('throws ForbiddenException when caller does not own the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(service.create('course-123', { name: 'Team Beta' }, otherUser)).rejects.toThrow(
        ForbiddenException,
      );

      expect(groupsRepository.create).not.toHaveBeenCalled();
    });

    it('allows admin to create group for a course they do not own', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.create.mockResolvedValue(mockGroup);

      await service.create('course-123', { name: 'Team Alpha' }, adminUser);

      expect(groupsRepository.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws ConflictException when group has members', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(mockGroupWithCount);

      await expect(service.delete('course-123', 'group-123', instructorUser)).rejects.toThrow(
        ConflictException,
      );

      expect(groupsRepository.delete).not.toHaveBeenCalled();
    });

    it('succeeds when group has no members', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      const emptyGroup: CourseGroupWithCount = { ...mockGroupWithCount, _count: { members: 0 } };
      groupsRepository.findByIdAndCourseId.mockResolvedValue(emptyGroup);
      groupsRepository.delete.mockResolvedValue(mockGroup);

      await service.delete('course-123', 'group-123', instructorUser);

      expect(groupsRepository.delete).toHaveBeenCalledWith('group-123');
    });

    it('throws NotFoundException when group does not exist in the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(null);

      await expect(service.delete('course-123', 'nonexistent', instructorUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller does not own the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(service.delete('course-123', 'group-123', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addMember', () => {
    it('throws BadRequestException when user is not enrolled in the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(mockGroupWithCount);
      enrollmentsService.isEnrolled.mockResolvedValue(false);

      await expect(
        service.addMember('course-123', 'group-123', { userId: 'user-456' }, instructorUser),
      ).rejects.toThrow(BadRequestException);

      expect(groupsRepository.addMember).not.toHaveBeenCalled();
    });

    it('throws ConflictException when user is already in a group for this course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(mockGroupWithCount);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      groupsRepository.findUserGroupInCourse.mockResolvedValue(mockMember);

      await expect(
        service.addMember('course-123', 'group-123', { userId: 'user-456' }, instructorUser),
      ).rejects.toThrow(ConflictException);

      expect(groupsRepository.addMember).not.toHaveBeenCalled();
    });

    it('throws ConflictException when group is full', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      const fullGroup: CourseGroupWithCount = {
        ...mockGroupWithCount,
        maxMembers: 2,
        _count: { members: 2 },
      };
      groupsRepository.findByIdAndCourseId.mockResolvedValue(fullGroup);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      groupsRepository.findUserGroupInCourse.mockResolvedValue(null);

      await expect(
        service.addMember('course-123', 'group-123', { userId: 'user-456' }, instructorUser),
      ).rejects.toThrow(ConflictException);

      expect(groupsRepository.addMember).not.toHaveBeenCalled();
    });

    it('adds member successfully when all checks pass', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(mockGroupWithCount);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      groupsRepository.findUserGroupInCourse.mockResolvedValue(null);
      groupsRepository.addMember.mockResolvedValue(mockMember);

      const result = await service.addMember(
        'course-123',
        'group-123',
        { userId: 'user-456' },
        instructorUser,
      );

      expect(groupsRepository.addMember).toHaveBeenCalledWith('group-123', 'user-456');
      expect(result.userId).toBe('user-456');
      expect(result.groupId).toBe('group-123');
    });

    it('adds member when group has no maxMembers limit', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      const unlimitedGroup: CourseGroupWithCount = {
        ...mockGroupWithCount,
        maxMembers: null,
        _count: { members: 100 },
      };
      groupsRepository.findByIdAndCourseId.mockResolvedValue(unlimitedGroup);
      enrollmentsService.isEnrolled.mockResolvedValue(true);
      groupsRepository.findUserGroupInCourse.mockResolvedValue(null);
      groupsRepository.addMember.mockResolvedValue(mockMember);

      await service.addMember('course-123', 'group-123', { userId: 'user-456' }, instructorUser);

      expect(groupsRepository.addMember).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('calls removeMember on repository after ownership and group checks pass', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(mockGroupWithCount);
      groupsRepository.removeMember.mockResolvedValue(undefined);

      await service.removeMember('course-123', 'group-123', 'user-456', instructorUser);

      expect(groupsRepository.removeMember).toHaveBeenCalledWith('group-123', 'user-456');
    });

    it('throws NotFoundException when group does not exist in the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);
      groupsRepository.findByIdAndCourseId.mockResolvedValue(null);

      await expect(
        service.removeMember('course-123', 'nonexistent', 'user-456', instructorUser),
      ).rejects.toThrow(NotFoundException);

      expect(groupsRepository.removeMember).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller does not own the course', async () => {
      coursesService.findOne.mockResolvedValue(mockCourseDetail);

      await expect(
        service.removeMember('course-123', 'group-123', 'user-456', otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
