import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { CourseModulesController } from './course-modules.controller';
import { CourseModulesRepository } from './course-modules.repository';
import { CourseModulesService } from './course-modules.service';
import { CourseModuleOwnerGuard } from './guards/course-module-owner.guard';

@Module({
  imports: [CoursesModule],
  controllers: [CourseModulesController],
  providers: [CourseModulesService, CourseModulesRepository, CourseModuleOwnerGuard],
  exports: [CourseModulesService],
})
export class CourseModulesModule {}
