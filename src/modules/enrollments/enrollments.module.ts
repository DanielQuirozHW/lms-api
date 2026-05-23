import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsRepository } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [CoursesModule, NotificationsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentsRepository],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
