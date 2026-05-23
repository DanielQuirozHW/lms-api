import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AssignmentSettings, Submission } from '@prisma/client';
import { GradingType, NotificationType } from '@prisma/client';
import {
  type LessonWithAssignmentContext,
  type SubmissionWithContext,
  AssignmentsRepository,
} from './assignments.repository';
import { AssignmentsService } from './assignments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RubricsService } from '../rubrics/rubrics.service';

const mockSettings: AssignmentSettings = {
  id: 'settings-123',
  lessonId: 'lesson-123',
  gradingType: GradingType.MANUAL,
  maxScore: 100,
  passingScore: 70,
  dueDate: null,
  allowLateSubmission: false,
  isGroupAssignment: false,
  groupId: null,
};

const mockLessonWithContext: LessonWithAssignmentContext = {
  id: 'lesson-123',
  moduleId: 'module-123',
  title: 'Assignment: Final Project',
  order: 1,
  type: 'ASSIGNMENT',
  content: null,
  videoUrl: null,
  duration: null,
  isPreview: false,
  isPublished: true,
  rubricId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  module: {
    id: 'module-123',
    courseId: 'course-123',
    course: { instructorId: 'instructor-123' },
  },
  assignmentSettings: mockSettings,
};

const mockSubmission: Submission = {
  id: 'sub-123',
  enrollmentId: 'enrollment-123',
  lessonId: 'lesson-123',
  content: 'My answer',
  fileUrl: null,
  submittedAt: new Date('2024-01-01'),
  attemptNumber: 1,
  grade: null,
  feedback: null,
  gradedById: null,
  gradedAt: null,
  groupId: null,
};

const mockSubmissionWithContext: SubmissionWithContext = {
  ...mockSubmission,
  enrollment: { userId: 'student-123', courseId: 'course-123' },
};

const instructor = {
  id: 'instructor-123',
  email: 'inst@example.com',
  roles: ['INSTRUCTOR' as const],
  isVerified: true,
};
const student = {
  id: 'student-123',
  email: 'stu@example.com',
  roles: ['STUDENT' as const],
  isVerified: true,
};

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let repo: jest.Mocked<
    Pick<
      AssignmentsRepository,
      | 'findLessonWithContext'
      | 'upsertSettings'
      | 'findActiveEnrollment'
      | 'countSubmissions'
      | 'createSubmission'
      | 'findSubmissionsByLesson'
      | 'findSubmissionsByEnrollment'
      | 'findSubmissionById'
      | 'updateSubmission'
      | 'findPendingSubmissions'
      | 'findUserGroupId'
      | 'findSubmissionsByGroupAndLesson'
      | 'completeLessonProgress'
    >
  >;
  let notificationsSvc: jest.Mocked<Pick<NotificationsService, 'notify'>>;
  let rubricsSvc: jest.Mocked<Pick<RubricsService, 'createAssessment'>>;

  beforeEach(async () => {
    repo = {
      findLessonWithContext: jest.fn(),
      upsertSettings: jest.fn(),
      findActiveEnrollment: jest.fn(),
      countSubmissions: jest.fn(),
      createSubmission: jest.fn(),
      findSubmissionsByLesson: jest.fn(),
      findSubmissionsByEnrollment: jest.fn(),
      findSubmissionById: jest.fn(),
      updateSubmission: jest.fn(),
      findPendingSubmissions: jest.fn(),
      findUserGroupId: jest.fn(),
      findSubmissionsByGroupAndLesson: jest.fn(),
      completeLessonProgress: jest.fn(),
    };
    notificationsSvc = { notify: jest.fn() };
    rubricsSvc = { createAssessment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: AssignmentsRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsSvc },
        { provide: RubricsService, useValue: rubricsSvc },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lesson type guard', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findLessonWithContext.mockResolvedValue(null);

      await expect(service.submit('lesson-123', { content: 'My answer' }, student)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when lesson is not an assignment', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        type: 'QUIZ',
      });

      await expect(service.submit('lesson-123', { content: 'My answer' }, student)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submit', () => {
    it('creates submission with auto-incremented attemptNumber', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      repo.countSubmissions.mockResolvedValue(1);
      repo.createSubmission.mockResolvedValue({ ...mockSubmission, attemptNumber: 2 });

      const result = await service.submit('lesson-123', { content: 'My answer' }, student);

      expect(repo.countSubmissions).toHaveBeenCalledWith('enrollment-123', 'lesson-123');
      expect(repo.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ attemptNumber: 2, enrollmentId: 'enrollment-123' }),
      );
      expect(result.attemptNumber).toBe(2);
    });

    it('auto-grade pass: sets grade=maxScore and completes progress when grade >= passingScore', async () => {
      const autoSettings: AssignmentSettings = {
        ...mockSettings,
        gradingType: GradingType.AUTOMATIC,
        maxScore: 100,
        passingScore: 70,
      };
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        assignmentSettings: autoSettings,
      });
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      repo.countSubmissions.mockResolvedValue(0);
      repo.createSubmission.mockResolvedValue({ ...mockSubmission, grade: 100 });
      repo.completeLessonProgress.mockResolvedValue(undefined);
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.submit('lesson-123', { content: 'My answer' }, student);

      expect(repo.createSubmission).toHaveBeenCalledWith(expect.objectContaining({ grade: 100 }));
      expect(repo.completeLessonProgress).toHaveBeenCalledWith('enrollment-123', 'lesson-123');
      expect(notificationsSvc.notify).toHaveBeenCalledWith(
        'student-123',
        NotificationType.ASSIGNMENT_GRADED,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'submission',
      );
    });

    it('auto-grade fail: sets grade=maxScore but does not complete progress when grade < passingScore', async () => {
      const autoSettings: AssignmentSettings = {
        ...mockSettings,
        gradingType: GradingType.AUTOMATIC,
        maxScore: 50,
        passingScore: 70,
      };
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        assignmentSettings: autoSettings,
      });
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      repo.countSubmissions.mockResolvedValue(0);
      repo.createSubmission.mockResolvedValue({ ...mockSubmission, grade: 50 });
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.submit('lesson-123', { content: 'My answer' }, student);

      expect(repo.createSubmission).toHaveBeenCalledWith(expect.objectContaining({ grade: 50 }));
      expect(repo.completeLessonProgress).not.toHaveBeenCalled();
      expect(notificationsSvc.notify).toHaveBeenCalled();
    });

    it('throws BadRequestException when submitted after due date with allowLateSubmission=false', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        assignmentSettings: {
          ...mockSettings,
          dueDate: new Date('2020-01-01'),
          allowLateSubmission: false,
        },
      });
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });

      await expect(service.submit('lesson-123', { content: 'My answer' }, student)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.createSubmission).not.toHaveBeenCalled();
    });

    it('allows late submission when allowLateSubmission=true', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        assignmentSettings: {
          ...mockSettings,
          dueDate: new Date('2020-01-01'),
          allowLateSubmission: true,
        },
      });
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      repo.countSubmissions.mockResolvedValue(0);
      repo.createSubmission.mockResolvedValue(mockSubmission);

      await expect(
        service.submit('lesson-123', { content: 'My answer' }, student),
      ).resolves.toBeDefined();
    });

    it('sets groupId for group assignments', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        assignmentSettings: { ...mockSettings, isGroupAssignment: true },
      });
      repo.findActiveEnrollment.mockResolvedValue({ id: 'enrollment-123' });
      repo.findUserGroupId.mockResolvedValue('group-123');
      repo.countSubmissions.mockResolvedValue(0);
      repo.createSubmission.mockResolvedValue({ ...mockSubmission, groupId: 'group-123' });

      const result = await service.submit('lesson-123', { content: 'My answer' }, student);

      expect(repo.findUserGroupId).toHaveBeenCalledWith('student-123', 'course-123');
      expect(repo.createSubmission).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'group-123' }),
      );
      expect(result.groupId).toBe('group-123');
    });

    it('throws ForbiddenException when student is not enrolled', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findActiveEnrollment.mockResolvedValue(null);

      await expect(service.submit('lesson-123', { content: 'My answer' }, student)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.createSubmission).not.toHaveBeenCalled();
    });
  });

  describe('gradeSubmission', () => {
    it('manual grade updates progress and notifies student when grade >= passingScore', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(mockSubmissionWithContext);
      repo.updateSubmission.mockResolvedValue({ ...mockSubmission, grade: 85 });
      repo.completeLessonProgress.mockResolvedValue(undefined);
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.gradeSubmission('lesson-123', 'sub-123', { grade: 85 }, instructor);

      expect(repo.updateSubmission).toHaveBeenCalledWith(
        'sub-123',
        expect.objectContaining({ grade: 85, gradedById: 'instructor-123' }),
      );
      expect(repo.completeLessonProgress).toHaveBeenCalledWith('enrollment-123', 'lesson-123');
      expect(notificationsSvc.notify).toHaveBeenCalledWith(
        'student-123',
        NotificationType.ASSIGNMENT_GRADED,
        expect.any(String),
        expect.any(String),
        'sub-123',
        'submission',
      );
    });

    it('manual grade does NOT update progress when grade < passingScore', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(mockSubmissionWithContext);
      repo.updateSubmission.mockResolvedValue({ ...mockSubmission, grade: 50 });
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.gradeSubmission('lesson-123', 'sub-123', { grade: 50 }, instructor);

      expect(repo.completeLessonProgress).not.toHaveBeenCalled();
      expect(notificationsSvc.notify).toHaveBeenCalled();
    });

    it('creates rubric assessment when lesson has rubricId and rubricAnswers are provided', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        rubricId: 'rubric-123',
      });
      repo.findSubmissionById.mockResolvedValue(mockSubmissionWithContext);
      repo.updateSubmission.mockResolvedValue({ ...mockSubmission, grade: 85 });
      repo.completeLessonProgress.mockResolvedValue(undefined);
      rubricsSvc.createAssessment.mockResolvedValue({} as never);
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.gradeSubmission(
        'lesson-123',
        'sub-123',
        {
          grade: 85,
          feedback: 'Well done',
          rubricAnswers: [{ criterionId: 'crit-123', pointsAwarded: 18 }],
        },
        instructor,
      );

      expect(rubricsSvc.createAssessment).toHaveBeenCalledWith(
        'course-123',
        'rubric-123',
        'sub-123',
        expect.objectContaining({
          answers: expect.arrayContaining([
            expect.objectContaining({ criterionId: 'crit-123', pointsAwarded: 18 }),
          ]) as unknown,
        }),
        instructor,
      );
    });

    it('propagates grade to all group members when submission has groupId', async () => {
      const groupSubmission: SubmissionWithContext = {
        ...mockSubmissionWithContext,
        groupId: 'group-123',
      };
      const memberSubmission: Submission = {
        ...mockSubmission,
        id: 'sub-456',
        enrollmentId: 'enrollment-456',
        groupId: 'group-123',
      };

      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(groupSubmission);
      repo.updateSubmission.mockResolvedValue({
        ...mockSubmission,
        grade: 90,
        groupId: 'group-123',
      });
      repo.findSubmissionsByGroupAndLesson.mockResolvedValue([
        { ...mockSubmission, groupId: 'group-123' }, // primary (id=sub-123, skipped)
        memberSubmission,
      ]);
      repo.completeLessonProgress.mockResolvedValue(undefined);
      notificationsSvc.notify.mockResolvedValue(undefined);

      await service.gradeSubmission('lesson-123', 'sub-123', { grade: 90 }, instructor);

      expect(repo.findSubmissionsByGroupAndLesson).toHaveBeenCalledWith('group-123', 'lesson-123');
      // Group member's submission updated
      expect(repo.updateSubmission).toHaveBeenCalledWith(
        'sub-456',
        expect.objectContaining({ grade: 90 }),
      );
      // Progress updated for both primary and member
      expect(repo.completeLessonProgress).toHaveBeenCalledWith('enrollment-123', 'lesson-123');
      expect(repo.completeLessonProgress).toHaveBeenCalledWith('enrollment-456', 'lesson-123');
    });

    it('throws NotFoundException when submission not found', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(null);

      await expect(
        service.gradeSubmission('lesson-123', 'nonexistent', { grade: 85 }, instructor),
      ).rejects.toThrow(NotFoundException);
      expect(repo.updateSubmission).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when submission belongs to a different lesson (BOLA guard)', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue({
        ...mockSubmissionWithContext,
        lessonId: 'other-lesson',
      });

      await expect(
        service.gradeSubmission('lesson-123', 'sub-123', { grade: 85 }, instructor),
      ).rejects.toThrow(NotFoundException);
      expect(repo.updateSubmission).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when instructor does not own the course', async () => {
      repo.findLessonWithContext.mockResolvedValue({
        ...mockLessonWithContext,
        module: {
          id: 'module-123',
          courseId: 'course-123',
          course: { instructorId: 'other-instructor' },
        },
      });

      await expect(
        service.gradeSubmission('lesson-123', 'sub-123', { grade: 85 }, instructor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSubmission', () => {
    it('returns submission to the instructor who owns the course', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(mockSubmissionWithContext);

      const result = await service.getSubmission('lesson-123', 'sub-123', instructor);

      expect(result.id).toBe('sub-123');
    });

    it('returns own submission to the student', async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue(mockSubmissionWithContext);

      const result = await service.getSubmission('lesson-123', 'sub-123', student);

      expect(result.id).toBe('sub-123');
    });

    it("throws ForbiddenException when student tries to view another student's submission", async () => {
      repo.findLessonWithContext.mockResolvedValue(mockLessonWithContext);
      repo.findSubmissionById.mockResolvedValue({
        ...mockSubmissionWithContext,
        enrollment: { userId: 'other-student', courseId: 'course-123' },
      });

      await expect(service.getSubmission('lesson-123', 'sub-123', student)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
