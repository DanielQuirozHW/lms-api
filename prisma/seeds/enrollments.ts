import type { PrismaClient } from '@prisma/client';
import { EnrollmentStatus } from '@prisma/client';
import type { UsersMap } from './users';
import type { CoursesMap, CourseSlug } from './courses';

// ── exported type ─────────────────────────────────────────────────────────────

/** `${userId}_${courseId}` → enrollmentId */
export type EnrollmentsMap = Record<string, string>;

// ── private helpers ───────────────────────────────────────────────────────────

// Reference date — keeps all seed timestamps deterministic on re-runs
const SEED_NOW = new Date('2026-06-23T12:00:00Z');

function msAgo(days: number): Date {
  return new Date(SEED_NOW.getTime() - days * 86_400_000);
}

/** Returns `count` completion dates spread evenly before `anchor`. */
function spreadBefore(anchor: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const daysBack = (count - 1 - i) * 3;
    return new Date(anchor.getTime() - daysBack * 86_400_000);
  });
}

type UserKey = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 's10' | 'ldquiroz';

type CompletedSpec = {
  sKey: UserKey;
  slug: CourseSlug;
  grade: number;
  comp: string; // ISO date string YYYY-MM-DD
  cert: string; // certificate code
};

type ActiveSpec = {
  sKey: UserKey;
  slugs: CourseSlug[];
};

// ── enrollment data ───────────────────────────────────────────────────────────

const COMPLETED: CompletedSpec[] = [
  {
    sKey: 's1',
    slug: 'react-nextjs-fullstack',
    grade: 92,
    comp: '2026-05-15',
    cert: 'CERT-REACT-2026-TORRES',
  },
  {
    sKey: 's2',
    slug: 'python-data-science',
    grade: 88,
    comp: '2026-05-20',
    cert: 'CERT-PYTHON-2026-RAMIREZ',
  },
  {
    sKey: 's3',
    slug: 'diseno-ux-ui-figma',
    grade: 95,
    comp: '2026-04-30',
    cert: 'CERT-DISENO-2026-HERNANDEZ',
  },
  {
    sKey: 's4',
    slug: 'machine-learning-python',
    grade: 84,
    comp: '2026-06-01',
    cert: 'CERT-MACHINE-2026-CRUZ',
  },
  {
    sKey: 's5',
    slug: 'typescript-avanzado',
    grade: 96,
    comp: '2026-05-10',
    cert: 'CERT-TYPESCRIPT-2026-MORALES',
  },
  {
    sKey: 's6',
    slug: 'deep-learning-redes-neuronales',
    grade: 78,
    comp: '2026-06-05',
    cert: 'CERT-DEEP-2026-VARGAS',
  },
  {
    sKey: 's7',
    slug: 'sql-postgresql-practico',
    grade: 91,
    comp: '2026-05-25',
    cert: 'CERT-SQL-2026-RIOS',
  },
  {
    sKey: 's8',
    slug: 'docker-kubernetes-devops',
    grade: 86,
    comp: '2026-06-10',
    cert: 'CERT-DOCKER-2026-JIMENEZ',
  },
  {
    sKey: 's9',
    slug: 'marketing-digital-seo',
    grade: 89,
    comp: '2026-06-03',
    cert: 'CERT-MARKETING-2026-FERNANDEZ',
  },
  {
    sKey: 's10',
    slug: 'python-data-science',
    grade: 93,
    comp: '2026-05-18',
    cert: 'CERT-PYTHON-2026-SANCHEZ',
  },
];

const ACTIVE: ActiveSpec[] = [
  { sKey: 's1', slugs: ['typescript-avanzado', 'sql-postgresql-practico'] },
  {
    sKey: 's2',
    slugs: ['typescript-avanzado', 'deep-learning-redes-neuronales', 'ciberseguridad-fundamentos'],
  },
  { sKey: 's3', slugs: ['react-nextjs-fullstack', 'marketing-digital-seo'] },
  {
    sKey: 's4',
    slugs: ['python-data-science', 'sql-postgresql-practico', 'docker-kubernetes-devops'],
  },
  {
    sKey: 's5',
    slugs: [
      'diseno-ux-ui-figma',
      'react-nextjs-fullstack',
      'marketing-digital-seo',
      'ciberseguridad-fundamentos',
    ],
  },
  { sKey: 's6', slugs: ['machine-learning-python', 'marketing-digital-seo'] },
  {
    sKey: 's7',
    slugs: ['python-data-science', 'react-nextjs-fullstack', 'ciberseguridad-fundamentos'],
  },
  {
    sKey: 's8',
    slugs: ['typescript-avanzado', 'machine-learning-python', 'deep-learning-redes-neuronales'],
  },
  {
    sKey: 's9',
    slugs: ['diseno-ux-ui-figma', 'sql-postgresql-practico', 'ciberseguridad-fundamentos'],
  },
  {
    sKey: 's10',
    slugs: [
      'machine-learning-python',
      'react-nextjs-fullstack',
      'deep-learning-redes-neuronales',
      'ciberseguridad-fundamentos',
    ],
  },
  { sKey: 'ldquiroz', slugs: ['typescript-avanzado', 'python-data-science', 'diseno-ux-ui-figma'] },
];

// ── exported function ─────────────────────────────────────────────────────────

export async function seedEnrollments(
  prisma: PrismaClient,
  users: UsersMap,
  courses: CoursesMap,
  courseLessons: Record<string, string[]>,
): Promise<EnrollmentsMap> {
  const map: EnrollmentsMap = {};

  // ── completed enrollments ─────────────────────────────────────────────────

  for (const spec of COMPLETED) {
    const userId = users[spec.sKey].id;
    const courseId = courses[spec.slug];
    const compDate = new Date(`${spec.comp}T18:00:00Z`);

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
        status: EnrollmentStatus.COMPLETED,
        finalGrade: spec.grade,
        completedAt: compDate,
        gradedAt: compDate,
        createdBy: users.ldquiroz.id,
        updatedBy: users.ldquiroz.id,
      },
    });
    map[`${userId}_${courseId}`] = enrollment.id;

    // All 12 lessons completed — spread evenly over 33 days before completion
    const lessonIds = courseLessons[courseId];
    const timestamps = spreadBefore(compDate, lessonIds.length);

    await prisma.lessonProgress.createMany({
      data: lessonIds.map((lessonId, i) => ({
        enrollmentId: enrollment.id,
        lessonId,
        startedAt: new Date(timestamps[i].getTime() - 30 * 60_000),
        completedAt: timestamps[i],
        createdBy: users.ldquiroz.id,
      })),
      skipDuplicates: true,
    });

    // Certificate
    await prisma.certificate.create({
      data: {
        userId,
        courseId,
        enrollmentId: enrollment.id,
        certificateCode: spec.cert,
        finalGrade: spec.grade,
        createdBy: users.ldquiroz.id,
      },
    });
  }

  // ── active enrollments ────────────────────────────────────────────────────

  const ACTIVE_COMPLETED_LESSONS = 7; // 7/12 ≈ 58% — within the 50-70% range

  for (const spec of ACTIVE) {
    for (const slug of spec.slugs) {
      const userId = users[spec.sKey].id;
      const courseId = courses[slug];

      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          status: EnrollmentStatus.ACTIVE,
          createdBy: users.ldquiroz.id,
        },
      });
      map[`${userId}_${courseId}`] = enrollment.id;

      // First 7 lessons completed, spread over the past 24 days
      const lessonIds = courseLessons[courseId];
      const partial = lessonIds.slice(0, ACTIVE_COMPLETED_LESSONS);

      await prisma.lessonProgress.createMany({
        data: partial.map((lessonId, i) => {
          const daysBack = (ACTIVE_COMPLETED_LESSONS - 1 - i) * 4;
          const completedAt = msAgo(daysBack);
          return {
            enrollmentId: enrollment.id,
            lessonId,
            startedAt: new Date(completedAt.getTime() - 30 * 60_000),
            completedAt,
            createdBy: users.ldquiroz.id,
          };
        }),
        skipDuplicates: true,
      });
    }
  }

  // 10 completed + 32 active = 42 enrollments total
  // LessonProgress: 10 × 12 + 32 × 7 = 120 + 224 = 344 records
  console.log('✅ Enrollments (10 completed + 32 active = 42 total)');
  console.log('✅ LessonProgress (344 records)');
  console.log('✅ Certificates (10)');

  return map;
}
