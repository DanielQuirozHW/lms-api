import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DripRepository } from './drip.repository';
import { DripService } from './drip.service';

@Module({
  imports: [NotificationsModule],
  providers: [DripService, DripRepository],
})
export class DripModule {}
