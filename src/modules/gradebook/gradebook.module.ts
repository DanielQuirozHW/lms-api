import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { GradebookController } from './gradebook.controller';
import { GradebookRepository } from './gradebook.repository';
import { GradebookService } from './gradebook.service';

@Module({
  imports: [CoursesModule],
  controllers: [GradebookController],
  providers: [GradebookService, GradebookRepository],
  exports: [GradebookService],
})
export class GradebookModule {}
