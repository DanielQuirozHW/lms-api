import { Test, type TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import type { DripEnrollment } from './drip.repository';
import { DripRepository } from './drip.repository';
import { DripService } from './drip.service';

const makeEnrollment = (
  daysAgo: number,
  unlockAfterDays: number,
  lessonIds = ['les-1'],
): DripEnrollment => ({
  id: 'enr-1',
  userId: 'user-1',
  courseId: 'course-1',
  createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  course: {
    modules: [
      { id: 'mod-1', title: 'Module 1', unlockAfterDays, lessons: lessonIds.map((id) => ({ id })) },
    ],
  },
});

describe('DripService', () => {
  let service: DripService;
  let dripRepository: jest.Mocked<
    Pick<DripRepository, 'findActiveEnrollmentsWithDripModules' | 'unlockModuleLessons'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'notify'>>;

  beforeEach(async () => {
    dripRepository = {
      findActiveEnrollmentsWithDripModules: jest.fn().mockResolvedValue([]),
      unlockModuleLessons: jest.fn().mockResolvedValue(0),
    };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DripService,
        { provide: DripRepository, useValue: dripRepository },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<DripService>(DripService);
  });

  describe('unlockDripContent', () => {
    it('does nothing when there are no active enrollments', async () => {
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([]);
      await service.unlockDripContent();
      expect(dripRepository.unlockModuleLessons).not.toHaveBeenCalled();
      expect(notificationsService.notify).not.toHaveBeenCalled();
    });

    it('does not unlock when daysEnrolled < unlockAfterDays', async () => {
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([
        makeEnrollment(3, 7),
      ] as never);
      await service.unlockDripContent();
      expect(dripRepository.unlockModuleLessons).not.toHaveBeenCalled();
    });

    it('unlocks lessons and sends notification when daysEnrolled >= unlockAfterDays', async () => {
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([
        makeEnrollment(8, 7, ['les-1', 'les-2']),
      ] as never);
      dripRepository.unlockModuleLessons.mockResolvedValue(2);

      await service.unlockDripContent();

      expect(dripRepository.unlockModuleLessons).toHaveBeenCalledWith('enr-1', ['les-1', 'les-2']);
      expect(notificationsService.notify).toHaveBeenCalledWith(
        'user-1',
        NotificationType.NEW_LESSON,
        expect.any(String),
        expect.stringContaining('Module 1'),
        'course-1',
        'course',
      );
    });

    it('does not notify when all lessons were already unlocked (count = 0)', async () => {
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([
        makeEnrollment(10, 7),
      ] as never);
      dripRepository.unlockModuleLessons.mockResolvedValue(0);

      await service.unlockDripContent();

      expect(dripRepository.unlockModuleLessons).toHaveBeenCalled();
      expect(notificationsService.notify).not.toHaveBeenCalled();
    });

    it('skips modules with no published lessons', async () => {
      const enrollment = makeEnrollment(10, 7, []);
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([enrollment] as never);

      await service.unlockDripContent();

      expect(dripRepository.unlockModuleLessons).not.toHaveBeenCalled();
    });

    it('unlocks exactly on the threshold day (daysEnrolled === unlockAfterDays)', async () => {
      dripRepository.findActiveEnrollmentsWithDripModules.mockResolvedValue([
        makeEnrollment(7, 7),
      ] as never);
      dripRepository.unlockModuleLessons.mockResolvedValue(1);

      await service.unlockDripContent();

      expect(dripRepository.unlockModuleLessons).toHaveBeenCalled();
    });
  });
});
