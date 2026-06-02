import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentCodesController } from './enrollment-codes.controller';
import { EnrollmentCodesRepository } from './enrollment-codes.repository';
import { EnrollmentCodesService } from './enrollment-codes.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsRepository } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';
import { UserEnrollmentsController } from './user-enrollments.controller';

@Module({
  imports: [CoursesModule, NotificationsModule],
  controllers: [EnrollmentsController, EnrollmentCodesController, UserEnrollmentsController],
  providers: [
    EnrollmentsService,
    EnrollmentsRepository,
    EnrollmentCodesService,
    EnrollmentCodesRepository,
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
