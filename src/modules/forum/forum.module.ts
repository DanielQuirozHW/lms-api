import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoursesModule } from '../courses/courses.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ForumController } from './forum.controller';
import { ForumGateway } from './forum.gateway';
import { ForumRepository } from './forum.repository';
import { ForumService } from './forum.service';

@Module({
  imports: [JwtModule.register({}), CoursesModule, EnrollmentsModule],
  controllers: [ForumController],
  providers: [ForumService, ForumRepository, ForumGateway],
  exports: [ForumService],
})
export class ForumModule {}
