import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { LessonsController } from './lessons.controller';
import { LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';
import { LessonOwnerGuard } from './guards/lesson-owner.guard';

@Module({
  imports: [CoursesModule],
  controllers: [LessonsController],
  providers: [LessonsService, LessonsRepository, LessonOwnerGuard],
  exports: [LessonsService],
})
export class LessonsModule {}
