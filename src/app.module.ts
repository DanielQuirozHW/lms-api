import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { configuration } from './config/configuration';
import { validate } from './config/env.validation';
import { ImpersonationGuard } from './common/guards/impersonation.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminModule } from './modules/admin/admin.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ErrorLogModule } from './modules/error-log/error-log.module';
import { GlobalAnnouncementsModule } from './modules/global-announcements/global-announcements.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { NotesModule } from './modules/notes/notes.module';
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
    JwtModule.register({}), // provides JwtService for MaintenanceGuard
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
    AdminModule,
    GlobalAnnouncementsModule,
    MaintenanceModule,
    NotesModule,
    BookmarksModule,
    CertificatesModule,
    ErrorLogModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard }, // before JWT — blocks non-admins during maintenance
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ImpersonationGuard },
    MaintenanceGuard, // explicit provider so JwtService dep resolves in AppModule scope
  ],
})
export class AppModule {}
