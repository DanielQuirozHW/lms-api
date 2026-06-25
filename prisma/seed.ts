import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { seedUsers, seedCategories } from './seeds/users';
import { seedCourses, seedModulesAndLessons } from './seeds/courses';
import { seedQuiz } from './seeds/quiz';
import { seedEnrollments } from './seeds/enrollments';
import { seedSocial } from './seeds/social';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main(): Promise<void> {
  // Wipe everything — cascade handles FK order
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE users, categories RESTART IDENTITY CASCADE`);
  console.log('✅ Database truncated\n');

  // ── 1. Users & categories ──────────────────────────────────────────────────
  const users = await seedUsers(prisma);
  const cats = await seedCategories(prisma, users);
  console.log();

  // ── 2. Courses + modules + lessons ────────────────────────────────────────
  const courses = await seedCourses(prisma, users, cats);
  const { courseLessons, quizLessons, assignmentLessons } = await seedModulesAndLessons(
    prisma,
    users,
    courses,
  );
  console.log();

  // ── 3. Quiz & assignment settings ─────────────────────────────────────────
  await seedQuiz(prisma, users, courseLessons, quizLessons, assignmentLessons);
  console.log();

  // ── 4. Enrollment codes (inline — only 2) ─────────────────────────────────
  await prisma.enrollmentCode.create({
    data: {
      courseId: courses['machine-learning-python'],
      code: 'ML2026',
      maxUses: 50,
      createdBy: users.ldquiroz.id,
    },
  });
  await prisma.enrollmentCode.create({
    data: {
      courseId: courses['docker-kubernetes-devops'],
      code: 'DEVOPS2026',
      maxUses: 30,
      createdBy: users.ldquiroz.id,
    },
  });
  console.log('✅ EnrollmentCodes (2)\n');

  // ── 5. Enrollments, lesson progress & certificates ────────────────────────
  const enrollments = await seedEnrollments(prisma, users, courses, courseLessons);
  console.log();

  // ── 6. Social layer ────────────────────────────────────────────────────────
  await seedSocial(prisma, users, courses, enrollments, courseLessons);
  console.log();

  // ── record counts ──────────────────────────────────────────────────────────
  const [
    userCount,
    categoryCount,
    courseCount,
    courseSettingsCount,
    moduleCount,
    lessonCount,
    quizSettingsCount,
    questionCount,
    questionOptionCount,
    assignmentSettingsCount,
    enrollmentCodeCount,
    enrollmentCount,
    lessonProgressCount,
    certificateCount,
    ratingCount,
    notifCount,
    announcementCount,
    threadCount,
    postCount,
    calEventCount,
    noteCount,
    bookmarkCount,
    notifPrefCount,
    loginEventCount,
    globalAnnouncementCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.course.count(),
    prisma.courseSettings.count(),
    prisma.courseModule.count(),
    prisma.lesson.count(),
    prisma.quizSettings.count(),
    prisma.question.count(),
    prisma.questionOption.count(),
    prisma.assignmentSettings.count(),
    prisma.enrollmentCode.count(),
    prisma.enrollment.count(),
    prisma.lessonProgress.count(),
    prisma.certificate.count(),
    prisma.courseRating.count(),
    prisma.notification.count(),
    prisma.announcement.count(),
    prisma.forumThread.count(),
    prisma.forumPost.count(),
    prisma.calendarEvent.count(),
    prisma.lessonNote.count(),
    prisma.lessonBookmark.count(),
    prisma.notificationPreferences.count(),
    prisma.loginEvent.count(),
    prisma.globalAnnouncement.count(),
  ]);

  const rows: [string, number][] = [
    ['Users', userCount],
    ['Categories', categoryCount],
    ['Courses', courseCount],
    ['CourseSettings', courseSettingsCount],
    ['CourseModules', moduleCount],
    ['Lessons', lessonCount],
    ['QuizSettings', quizSettingsCount],
    ['Questions', questionCount],
    ['QuestionOptions', questionOptionCount],
    ['AssignmentSettings', assignmentSettingsCount],
    ['EnrollmentCodes', enrollmentCodeCount],
    ['Enrollments', enrollmentCount],
    ['LessonProgress', lessonProgressCount],
    ['Certificates', certificateCount],
    ['CourseRatings', ratingCount],
    ['Notifications', notifCount],
    ['Announcements', announcementCount],
    ['ForumThreads', threadCount],
    ['ForumPosts', postCount],
    ['CalendarEvents', calEventCount],
    ['LessonNotes', noteCount],
    ['LessonBookmarks', bookmarkCount],
    ['NotificationPreferences', notifPrefCount],
    ['LoginEvents', loginEventCount],
    ['GlobalAnnouncements', globalAnnouncementCount],
  ];

  console.log('📊  Records per table:');
  for (const [label, count] of rows) {
    console.log(`    ${label.padEnd(26)} ${count}`);
  }
  console.log('\n🎉  Seed completed successfully!');
}

main()
  .catch((e: unknown) => {
    console.error('Fatal seed error:', e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
