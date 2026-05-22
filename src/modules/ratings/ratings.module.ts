import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RatingsController } from './ratings.controller';
import { RatingsRepository } from './ratings.repository';
import { RatingsService } from './ratings.service';

@Module({
  imports: [EnrollmentsModule, NotificationsModule],
  controllers: [RatingsController],
  providers: [RatingsService, RatingsRepository],
})
export class RatingsModule {}
