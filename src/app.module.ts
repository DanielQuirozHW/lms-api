import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthModule } from './health/health.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CoursesModule } from './modules/courses/courses.module';
import { CourseModulesModule } from './modules/course-modules/course-modules.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { ForumModule } from './modules/forum/forum.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { UsersModule } from './modules/users/users.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { GradebookModule } from './modules/gradebook/gradebook.module';
import { GroupsModule } from './modules/groups/groups.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { DripModule } from './modules/drip/drip.module';
import { RubricsModule } from './modules/rubrics/rubrics.module';
import { UploadModule } from './modules/upload/upload.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import type { AppConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [(): AppConfig => configuration(validate(process.env as Record<string, unknown>))],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get('throttle.ttl', { infer: true }) ?? 60000,
            limit: config.get('throttle.limit', { infer: true }) ?? 100,
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AnnouncementsModule,
    AuthModule,
    CategoriesModule,
    UsersModule,
    CoursesModule,
    CourseModulesModule,
    LessonsModule,
    EnrollmentsModule,
    ForumModule,
    MessagesModule,
    NotificationsModule,
    RatingsModule,
    CalendarModule,
    GradebookModule,
    GroupsModule,
    AssignmentsModule,
    QuizModule,
    RubricsModule,
    UploadModule,
    ScheduleModule.forRoot(),
    DripModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
