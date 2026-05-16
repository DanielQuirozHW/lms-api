import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import { CourseOwnerGuard } from './guards/course-owner.guard';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository, CourseOwnerGuard],
  exports: [CoursesService],
})
export class CoursesModule {}
