import { Module } from '@nestjs/common';
import { GlobalAnnouncementsController } from './global-announcements.controller';
import { GlobalAnnouncementsRepository } from './global-announcements.repository';
import { GlobalAnnouncementsService } from './global-announcements.service';

@Module({
  controllers: [GlobalAnnouncementsController],
  providers: [GlobalAnnouncementsService, GlobalAnnouncementsRepository],
  exports: [GlobalAnnouncementsService],
})
export class GlobalAnnouncementsModule {}
