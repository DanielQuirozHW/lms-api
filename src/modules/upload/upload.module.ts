import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module';
import { LessonsModule } from '../lessons/lessons.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../../storage/storage.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [StorageModule, UsersModule, CoursesModule, LessonsModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [], // internal — not consumed cross-module
})
export class UploadModule {}
