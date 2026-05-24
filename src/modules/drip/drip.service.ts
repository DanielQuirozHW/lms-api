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

      // M-7: collect all ready modules for this enrollment in one pass, then issue a single updateMany
      const readyModules = enrollment.course.modules.filter(
        (m) => m.unlockAfterDays !== null && daysEnrolled >= m.unlockAfterDays,
      );

      if (readyModules.length === 0) continue;

      const allLessonIds = readyModules.flatMap((m) => m.lessons.map((l) => l.id));
      if (allLessonIds.length === 0) continue;

      try {
        // One DB call per enrollment instead of one per (enrollment × module)
        const unlocked = await this.dripRepository.unlockModuleLessons(enrollment.id, allLessonIds);

        if (unlocked > 0) {
          unlockedTotal += unlocked;
          const moduleNames = readyModules.map((m) => m.title).join(', ');
          // L-2: catch notification errors instead of silently swallowing them
          this.notificationsService
            .notify(
              enrollment.userId,
              NotificationType.NEW_LESSON,
              'New lessons available',
              `The following module(s) are now available: ${moduleNames}`,
              enrollment.courseId,
              'course',
            )
            .catch((err: unknown) => {
              this.logger.error(
                `Notification failed for enrollment ${enrollment.id}`,
                (err as Error).message,
              );
            });
        }
      } catch (err) {
        // L-3: catch mid-loop errors so one failing enrollment doesn't abort the rest
        this.logger.warn(
          `Failed to unlock lessons for enrollment ${enrollment.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Drip unlock job completed — unlocked ${String(unlockedTotal)} lesson(s)`);
  }
}
