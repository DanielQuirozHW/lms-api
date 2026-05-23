import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { RubricsController } from './rubrics.controller';
import { RubricsRepository } from './rubrics.repository';
import { RubricsService } from './rubrics.service';

@Module({
  imports: [CoursesModule],
  controllers: [RubricsController],
  providers: [RubricsService, RubricsRepository],
  exports: [RubricsService],
})
export class RubricsModule {}
