import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { DripRepository } from './drip.repository';

@Injectable()
export class DripService {
  private readonly logger = new Logger(DripService.name);

  constructor(
    private readonly dripRepository: DripRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 0 * * *')
  async unlockDripContent(): Promise<void> {
    this.logger.log('Running drip content unlock job');
    const now = new Date();

    let enrollments;
    try {
      enrollments = await this.dripRepository.findActiveEnrollmentsWithDripModules();
    } catch (err) {
      this.logger.error('Failed to fetch enrollments for drip job', (err as Error).message);
      return;
    }

    let unlockedTotal = 0;

    for (const enrollment of enrollments) {
      const msEnrolled = now.getTime() - enrollment.enrolledAt.getTime();
      const daysEnrolled = msEnrolled / (1000 * 60 * 60 * 24);

      for (const module of enrollment.course.modules) {
        if (module.unlockAfterDays === null || daysEnrolled < module.unlockAfterDays) continue;

        const lessonIds = module.lessons.map((l) => l.id);
        if (lessonIds.length === 0) continue;

        const unlocked = await this.dripRepository.unlockModuleLessons(enrollment.id, lessonIds);
        if (unlocked > 0) {
          unlockedTotal += unlocked;
          void this.notificationsService.notify(
            enrollment.userId,
            NotificationType.NEW_LESSON,
            'New lessons available',
            `Module "${module.title}" is now available in your course.`,
            module.id,
            'CourseModule',
          );
        }
      }
    }

    this.logger.log(`Drip unlock job completed — unlocked ${String(unlockedTotal)} lesson(s)`);
  }
}
