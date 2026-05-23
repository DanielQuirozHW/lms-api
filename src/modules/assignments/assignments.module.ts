import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { GroupsModule } from '../groups/groups.module';
import { LessonsModule } from '../lessons/lessons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RubricsModule } from '../rubrics/rubrics.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsRepository } from './assignments.repository';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [LessonsModule, EnrollmentsModule, NotificationsModule, GroupsModule, RubricsModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService, AssignmentsRepository],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
