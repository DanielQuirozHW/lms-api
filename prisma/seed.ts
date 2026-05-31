import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  CourseStatus,
  LessonType,
  QuestionType,
  EnrollmentStatus,
  GlobalAnnouncementType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main(): Promise<void> {
  const PASSWORD_HASH = await bcrypt.hash('Password123!', 10);

  // ── 1. Users ──────────────────────────────────────────────────────────────
  let adminUser: { id: string } | null = null;
  const studentUsers: { id: string }[] = [];

  try {
    adminUser = await prisma.user.upsert({
      where: { email: 'ldquiroz@hwapplications.com' },
      update: { roles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN] },
      create: {
        email: 'ldquiroz@hwapplications.com',
        passwordHash: PASSWORD_HASH,
        firstName: 'Luis',
        lastName: 'Quiroz',
        roles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
        isVerified: true,
      },
    });

    await prisma.user.upsert({
      where: { email: 'instructor@nexuslms.com' },
      update: {},
      create: {
        email: 'instructor@nexuslms.com',
        passwordHash: PASSWORD_HASH,
        firstName: 'Carlos',
        lastName: 'Instructor',
        roles: [UserRole.INSTRUCTOR],
        isVerified: true,
      },
    });

    for (let i = 1; i <= 10; i++) {
      const student = await prisma.user.upsert({
        where: { email: `student${i}@nexuslms.com` },
        update: {},
        create: {
          email: `student${i}@nexuslms.com`,
          passwordHash: PASSWORD_HASH,
          firstName: 'Estudiante',
          lastName: String(i),
          roles: [UserRole.STUDENT],
          isVerified: true,
        },
      });
      studentUsers.push(student);
    }
    console.log('✅ Users created');
  } catch (e) {
    console.error('❌ Users failed', e);
  }

  if (!adminUser) {
    console.error('Admin user not found — aborting seed');
    return;
  }

  // ── 2. Categories ──────────────────────────────────────────────────────────
  const categories: Record<string, string> = {};

  try {
    const catDefs = [
      { name: 'Desarrollo Web', slug: 'desarrollo-web' },
      { name: 'Ciencia de Datos', slug: 'ciencia-de-datos' },
      { name: 'Diseño UX/UI', slug: 'diseno-ux-ui' },
      { name: 'Marketing Digital', slug: 'marketing-digital' },
      { name: 'Inteligencia Artificial', slug: 'inteligencia-artificial' },
    ];
    for (const cat of catDefs) {
      const c = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
      categories[cat.slug] = c.id;
    }
    console.log('✅ Categories created');
  } catch (e) {
    console.error('❌ Categories failed', e);
  }

  // ── 3. Courses ─────────────────────────────────────────────────────────────
  let c1Id = '';
  let c2Id = '';
  let c3Id = '';
  let c4Id = '';
  let c5Id = '';

  try {
    const c1 = await prisma.course.upsert({
      where: { slug: 'typescript-de-cero-a-experto' },
      update: {},
      create: {
        title: 'TypeScript de Cero a Experto',
        slug: 'typescript-de-cero-a-experto',
        description:
          'Aprende TypeScript desde los fundamentos hasta técnicas avanzadas en este curso completo.',
        status: CourseStatus.PUBLISHED,
        price: '29.99',
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c1Id = c1.id;

    const c2 = await prisma.course.upsert({
      where: { slug: 'python-para-data-science' },
      update: {},
      create: {
        title: 'Python para Data Science',
        slug: 'python-para-data-science',
        description: 'Domina Python y las principales librerías para ciencia de datos.',
        status: CourseStatus.PUBLISHED,
        instructorId: adminUser.id,
        categoryId: categories['ciencia-de-datos'] ?? null,
      },
    });
    c2Id = c2.id;

    const c3 = await prisma.course.upsert({
      where: { slug: 'diseno-de-interfaces-con-figma' },
      update: {},
      create: {
        title: 'Diseño de Interfaces con Figma',
        slug: 'diseno-de-interfaces-con-figma',
        description: 'Aprende a diseñar interfaces profesionales usando Figma desde cero.',
        status: CourseStatus.PUBLISHED,
        price: '19.99',
        instructorId: adminUser.id,
        categoryId: categories['diseno-ux-ui'] ?? null,
      },
    });
    c3Id = c3.id;

    const c4 = await prisma.course.upsert({
      where: { slug: 'machine-learning-practico' },
      update: {},
      create: {
        title: 'Machine Learning Práctico',
        slug: 'machine-learning-practico',
        description: 'Implementa algoritmos de ML con Python, scikit-learn y TensorFlow.',
        status: CourseStatus.PUBLISHED,
        price: '49.99',
        instructorId: adminUser.id,
        categoryId: categories['inteligencia-artificial'] ?? null,
      },
    });
    c4Id = c4.id;

    const c5 = await prisma.course.upsert({
      where: { slug: 'seo-y-marketing-de-contenidos' },
      update: {},
      create: {
        title: 'SEO y Marketing de Contenidos',
        slug: 'seo-y-marketing-de-contenidos',
        description:
          'Estrategias de SEO y marketing de contenidos para aumentar tu visibilidad online.',
        status: CourseStatus.DRAFT,
        price: '24.99',
        instructorId: adminUser.id,
        categoryId: categories['marketing-digital'] ?? null,
      },
    });
    c5Id = c5.id;

    console.log('✅ Courses created');
  } catch (e) {
    console.error('❌ Courses failed', e);
  }

  // ── 4. Modules & Lessons ───────────────────────────────────────────────────
  const c1Lessons: string[] = [];
  const c2Lessons: string[] = [];
  const c3Lessons: string[] = [];
  let quizLessonId = '';

  try {
    if (c1Id) {
      type LessonDef = { title: string; order: number; type: LessonType; isPreview?: boolean };
      type ModDef = { title: string; order: number; lessons: LessonDef[] };

      const c1Mods: ModDef[] = [
        {
          title: 'Fundamentos',
          order: 1,
          lessons: [
            { title: '¿Qué es TypeScript?', order: 1, type: LessonType.TEXT, isPreview: true },
            { title: 'Tipos básicos', order: 2, type: LessonType.TEXT },
            { title: 'Funciones tipadas', order: 3, type: LessonType.VIDEO },
          ],
        },
        {
          title: 'Tipos Avanzados',
          order: 2,
          lessons: [
            { title: 'Interfaces y Types', order: 1, type: LessonType.TEXT },
            { title: 'Genéricos', order: 2, type: LessonType.VIDEO },
            { title: 'Decoradores', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Proyecto Final',
          order: 3,
          lessons: [
            { title: 'Arquitectura del proyecto', order: 1, type: LessonType.TEXT },
            { title: 'Implementación', order: 2, type: LessonType.VIDEO },
            { title: 'Evaluación final', order: 3, type: LessonType.QUIZ },
          ],
        },
      ];

      for (const mod of c1Mods) {
        const m = await prisma.courseModule.upsert({
          where: { courseId_order: { courseId: c1Id, order: mod.order } },
          update: {},
          create: { courseId: c1Id, title: mod.title, order: mod.order, isPublished: true },
        });
        for (const les of mod.lessons) {
          const l = await prisma.lesson.upsert({
            where: { moduleId_order: { moduleId: m.id, order: les.order } },
            update: {},
            create: {
              moduleId: m.id,
              title: les.title,
              order: les.order,
              type: les.type,
              isPreview: les.isPreview ?? false,
              isPublished: true,
              content: `Contenido de la lección: ${les.title}`,
            },
          });
          c1Lessons.push(l.id);
          if (les.type === LessonType.QUIZ && mod.order === 3) {
            quizLessonId = l.id;
          }
        }
      }
    }

    if (c2Id) {
      const c2Mods = [
        {
          title: 'Introducción a Python',
          order: 1,
          lessons: [
            { title: 'Variables y tipos de datos', order: 1, type: LessonType.TEXT },
            { title: 'Control de flujo', order: 2, type: LessonType.TEXT },
            { title: 'Funciones en Python', order: 3, type: LessonType.VIDEO },
          ],
        },
        {
          title: 'Pandas y NumPy',
          order: 2,
          lessons: [
            { title: 'NumPy arrays', order: 1, type: LessonType.TEXT },
            { title: 'DataFrames con Pandas', order: 2, type: LessonType.VIDEO },
            { title: 'Visualización con Matplotlib', order: 3, type: LessonType.TEXT },
          ],
        },
      ];
      for (const mod of c2Mods) {
        const m = await prisma.courseModule.upsert({
          where: { courseId_order: { courseId: c2Id, order: mod.order } },
          update: {},
          create: { courseId: c2Id, title: mod.title, order: mod.order, isPublished: true },
        });
        for (const les of mod.lessons) {
          const l = await prisma.lesson.upsert({
            where: { moduleId_order: { moduleId: m.id, order: les.order } },
            update: {},
            create: {
              moduleId: m.id,
              title: les.title,
              order: les.order,
              type: les.type,
              isPreview: false,
              isPublished: true,
              content: `Contenido de la lección: ${les.title}`,
            },
          });
          c2Lessons.push(l.id);
        }
      }
    }

    if (c3Id) {
      const c3Mods = [
        {
          title: 'Fundamentos de Figma',
          order: 1,
          lessons: [
            { title: 'Interfaz de Figma', order: 1, type: LessonType.TEXT },
            { title: 'Componentes y variantes', order: 2, type: LessonType.VIDEO },
            { title: 'Auto Layout', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Prototipado',
          order: 2,
          lessons: [
            { title: 'Conexiones de prototipo', order: 1, type: LessonType.TEXT },
            { title: 'Animaciones en Figma', order: 2, type: LessonType.VIDEO },
            { title: 'Entrega al desarrollador', order: 3, type: LessonType.TEXT },
          ],
        },
      ];
      for (const mod of c3Mods) {
        const m = await prisma.courseModule.upsert({
          where: { courseId_order: { courseId: c3Id, order: mod.order } },
          update: {},
          create: { courseId: c3Id, title: mod.title, order: mod.order, isPublished: true },
        });
        for (const les of mod.lessons) {
          const l = await prisma.lesson.upsert({
            where: { moduleId_order: { moduleId: m.id, order: les.order } },
            update: {},
            create: {
              moduleId: m.id,
              title: les.title,
              order: les.order,
              type: les.type,
              isPreview: false,
              isPublished: true,
              content: `Contenido de la lección: ${les.title}`,
            },
          });
          c3Lessons.push(l.id);
        }
      }
    }

    if (c4Id) {
      const c4Mods = [
        {
          title: 'Fundamentos de ML',
          order: 1,
          lessons: [
            { title: '¿Qué es el Machine Learning?', order: 1, type: LessonType.TEXT },
            { title: 'Tipos de algoritmos', order: 2, type: LessonType.TEXT },
            { title: 'Preparación de datos', order: 3, type: LessonType.VIDEO },
          ],
        },
        {
          title: 'Algoritmos Supervisados',
          order: 2,
          lessons: [
            { title: 'Regresión lineal', order: 1, type: LessonType.TEXT },
            { title: 'Árboles de decisión', order: 2, type: LessonType.VIDEO },
            { title: 'Random Forest', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Deep Learning',
          order: 3,
          lessons: [
            { title: 'Redes neuronales', order: 1, type: LessonType.TEXT },
            { title: 'TensorFlow básico', order: 2, type: LessonType.VIDEO },
            { title: 'Proyecto final de ML', order: 3, type: LessonType.TEXT },
          ],
        },
      ];
      for (const mod of c4Mods) {
        const m = await prisma.courseModule.upsert({
          where: { courseId_order: { courseId: c4Id, order: mod.order } },
          update: {},
          create: { courseId: c4Id, title: mod.title, order: mod.order, isPublished: true },
        });
        for (const les of mod.lessons) {
          await prisma.lesson.upsert({
            where: { moduleId_order: { moduleId: m.id, order: les.order } },
            update: {},
            create: {
              moduleId: m.id,
              title: les.title,
              order: les.order,
              type: les.type,
              isPreview: false,
              isPublished: true,
              content: `Contenido de la lección: ${les.title}`,
            },
          });
        }
      }
    }

    if (c5Id) {
      const m = await prisma.courseModule.upsert({
        where: { courseId_order: { courseId: c5Id, order: 1 } },
        update: {},
        create: {
          courseId: c5Id,
          title: 'Introducción al SEO',
          order: 1,
          isPublished: false,
        },
      });
      for (const les of [
        { title: '¿Qué es el SEO?', order: 1 },
        { title: 'Investigación de palabras clave', order: 2 },
      ]) {
        await prisma.lesson.upsert({
          where: { moduleId_order: { moduleId: m.id, order: les.order } },
          update: {},
          create: {
            moduleId: m.id,
            title: les.title,
            order: les.order,
            type: LessonType.TEXT,
            isPreview: false,
            isPublished: false,
            content: `Contenido de la lección: ${les.title}`,
          },
        });
      }
    }

    console.log('✅ Modules and lessons created');
  } catch (e) {
    console.error('❌ Modules/Lessons failed', e);
  }

  // ── 5. Quiz (Course 1 Module 3) ────────────────────────────────────────────
  try {
    if (quizLessonId) {
      await prisma.quizSettings.upsert({
        where: { lessonId: quizLessonId },
        update: {},
        create: {
          lessonId: quizLessonId,
          passingScore: 70,
          maxAttempts: 3,
          blocksProgress: false,
          shuffleQuestions: true,
        },
      });

      const questionDefs = [
        {
          text: '¿Cuál es la diferencia principal entre `type` e `interface` en TypeScript?',
          type: QuestionType.SINGLE_CHOICE,
          order: 1,
          options: [
            {
              text: '`interface` solo puede describir objetos; `type` es más flexible',
              isCorrect: true,
              order: 1,
            },
            { text: 'Son exactamente lo mismo', isCorrect: false, order: 2 },
            { text: '`type` no admite herencia', isCorrect: false, order: 3 },
            {
              text: '`interface` admite tipos primitivos directamente',
              isCorrect: false,
              order: 4,
            },
          ],
        },
        {
          text: '¿Qué hace el operador `?` en una propiedad de interfaz?',
          type: QuestionType.SINGLE_CHOICE,
          order: 2,
          options: [
            { text: 'La hace obligatoria', isCorrect: false, order: 1 },
            { text: 'La hace opcional', isCorrect: true, order: 2 },
            { text: 'La convierte en readonly', isCorrect: false, order: 3 },
            { text: 'La elimina del tipo', isCorrect: false, order: 4 },
          ],
        },
        {
          text: '¿Cuál es la sintaxis correcta para un array de strings en TypeScript?',
          type: QuestionType.SINGLE_CHOICE,
          order: 3,
          options: [
            { text: 'string[] o Array<string>', isCorrect: true, order: 1 },
            { text: 'string()', isCorrect: false, order: 2 },
            { text: '[string]', isCorrect: false, order: 3 },
            { text: 'StringArray', isCorrect: false, order: 4 },
          ],
        },
        {
          text: 'TypeScript es un superconjunto de JavaScript.',
          type: QuestionType.TRUE_FALSE,
          order: 4,
          options: [
            { text: 'Verdadero', isCorrect: true, order: 1 },
            { text: 'Falso', isCorrect: false, order: 2 },
          ],
        },
        {
          text: 'El tipo `any` en TypeScript desactiva la verificación de tipos.',
          type: QuestionType.TRUE_FALSE,
          order: 5,
          options: [
            { text: 'Verdadero', isCorrect: true, order: 1 },
            { text: 'Falso', isCorrect: false, order: 2 },
          ],
        },
      ];

      for (const qDef of questionDefs) {
        const q = await prisma.question.upsert({
          where: { lessonId_order: { lessonId: quizLessonId, order: qDef.order } },
          update: {},
          create: {
            lessonId: quizLessonId,
            text: qDef.text,
            type: qDef.type,
            order: qDef.order,
            points: 1,
          },
        });
        for (const opt of qDef.options) {
          await prisma.questionOption.upsert({
            where: { questionId_order: { questionId: q.id, order: opt.order } },
            update: {},
            create: {
              questionId: q.id,
              text: opt.text,
              isCorrect: opt.isCorrect,
              order: opt.order,
            },
          });
        }
      }
      console.log('✅ Quiz created');
    }
  } catch (e) {
    console.error('❌ Quiz failed', e);
  }

  // ── 6. Enrollments ─────────────────────────────────────────────────────────
  let enrollC1: { id: string } | null = null;
  let enrollC2: { id: string } | null = null;
  let enrollC3: { id: string } | null = null;

  try {
    const now = new Date();

    if (c1Id) {
      enrollC1 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c1Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c1Id, status: EnrollmentStatus.ACTIVE },
      });
    }

    if (c2Id) {
      enrollC2 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c2Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c2Id, status: EnrollmentStatus.ACTIVE },
      });
    }

    if (c3Id) {
      enrollC3 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c3Id } },
        update: {},
        create: {
          userId: adminUser.id,
          courseId: c3Id,
          status: EnrollmentStatus.COMPLETED,
          finalGrade: 92,
          completedAt: now,
        },
      });
    }

    // 5 students → course 1
    for (let i = 0; i < 5 && i < studentUsers.length; i++) {
      if (c1Id) {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: studentUsers[i].id, courseId: c1Id } },
          update: {},
          create: {
            userId: studentUsers[i].id,
            courseId: c1Id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }

    // 3 students (6–8) → course 2
    for (let i = 5; i < 8 && i < studentUsers.length; i++) {
      if (c2Id) {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: studentUsers[i].id, courseId: c2Id } },
          update: {},
          create: {
            userId: studentUsers[i].id,
            courseId: c2Id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }

    // 8 students (1–8) → course 4
    for (let i = 0; i < 8 && i < studentUsers.length; i++) {
      if (c4Id) {
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: studentUsers[i].id, courseId: c4Id } },
          update: {},
          create: {
            userId: studentUsers[i].id,
            courseId: c4Id,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    }

    console.log('✅ Enrollments created');
  } catch (e) {
    console.error('❌ Enrollments failed', e);
  }

  // ── 7. Lesson Progress ─────────────────────────────────────────────────────
  try {
    const now = new Date();

    // Course 1: first 3 lessons (40% of 8)
    if (enrollC1) {
      for (let i = 0; i < 3 && i < c1Lessons.length; i++) {
        await prisma.lessonProgress.upsert({
          where: {
            enrollmentId_lessonId: { enrollmentId: enrollC1.id, lessonId: c1Lessons[i] },
          },
          update: {},
          create: {
            enrollmentId: enrollC1.id,
            lessonId: c1Lessons[i],
            startedAt: now,
            completedAt: now,
          },
        });
      }
    }

    // Course 2: first 5 lessons (80% of 6)
    if (enrollC2) {
      for (let i = 0; i < 5 && i < c2Lessons.length; i++) {
        await prisma.lessonProgress.upsert({
          where: {
            enrollmentId_lessonId: { enrollmentId: enrollC2.id, lessonId: c2Lessons[i] },
          },
          update: {},
          create: {
            enrollmentId: enrollC2.id,
            lessonId: c2Lessons[i],
            startedAt: now,
            completedAt: now,
          },
        });
      }
    }

    // Course 3: all lessons completed
    if (enrollC3) {
      for (const lessonId of c3Lessons) {
        await prisma.lessonProgress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId: enrollC3.id, lessonId } },
          update: {},
          create: {
            enrollmentId: enrollC3.id,
            lessonId,
            startedAt: now,
            completedAt: now,
          },
        });
      }
    }

    console.log('✅ Lesson progress created');
  } catch (e) {
    console.error('❌ Lesson progress failed', e);
  }

  // ── 8. Announcements ───────────────────────────────────────────────────────
  try {
    if (c1Id) {
      for (const ann of [
        {
          title: 'Bienvenidos al curso',
          body: '¡Bienvenidos a TypeScript de Cero a Experto! Estamos muy contentos de tenerlos aquí. En este curso aprenderán todo lo necesario para dominar TypeScript.',
        },
        {
          title: 'Nueva lección disponible',
          body: 'Se ha publicado una nueva lección en el Módulo 3: Proyecto Final. ¡No se la pierdan!',
        },
      ]) {
        const existing = await prisma.announcement.findFirst({
          where: { courseId: c1Id, title: ann.title },
        });
        if (!existing) {
          await prisma.announcement.create({
            data: { courseId: c1Id, instructorId: adminUser.id, ...ann },
          });
        }
      }
    }
    console.log('✅ Announcements created');
  } catch (e) {
    console.error('❌ Announcements failed', e);
  }

  // ── 9. Ratings ─────────────────────────────────────────────────────────────
  try {
    if (c3Id) {
      await prisma.courseRating.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c3Id } },
        update: {},
        create: {
          userId: adminUser.id,
          courseId: c3Id,
          score: 90,
          review: 'Excelente curso',
        },
      });
    }

    const scores = [85, 90, 75];
    for (let i = 0; i < 3 && i < studentUsers.length; i++) {
      if (c1Id) {
        await prisma.courseRating.upsert({
          where: { userId_courseId: { userId: studentUsers[i].id, courseId: c1Id } },
          update: {},
          create: { userId: studentUsers[i].id, courseId: c1Id, score: scores[i] },
        });
      }
    }
    console.log('✅ Ratings created');
  } catch (e) {
    console.error('❌ Ratings failed', e);
  }

  // ── 10. Forum Thread ───────────────────────────────────────────────────────
  try {
    if (c1Id && studentUsers.length >= 2) {
      let thread = await prisma.forumThread.findFirst({
        where: { courseId: c1Id, title: '¿Cómo instalar TypeScript?' },
      });
      if (!thread) {
        thread = await prisma.forumThread.create({
          data: {
            courseId: c1Id,
            authorId: adminUser.id,
            title: '¿Cómo instalar TypeScript?',
          },
        });
      }

      const postDefs = [
        {
          authorId: adminUser.id,
          content:
            'Para instalar TypeScript necesitas Node.js. Luego ejecuta: `npm install -g typescript`. Verifica con `tsc --version`.',
          parentId: null as string | null,
        },
        {
          authorId: studentUsers[0].id,
          content:
            'También lo pueden instalar localmente en el proyecto con `npm install --save-dev typescript`. Así cada proyecto usa su propia versión.',
          parentId: null as string | null,
        },
        {
          authorId: studentUsers[1].id,
          content:
            'Para VSCode, instalen la extensión TypeScript Hero para mejor autocompletado. ¡Hace una gran diferencia!',
          parentId: null as string | null,
        },
      ];

      // Create the first post and capture its id for replies
      for (let i = 0; i < postDefs.length; i++) {
        const existing = await prisma.forumPost.findFirst({
          where: { threadId: thread.id, authorId: postDefs[i].authorId },
        });
        if (!existing) {
          const post = await prisma.forumPost.create({
            data: {
              threadId: thread.id,
              authorId: postDefs[i].authorId,
              content: postDefs[i].content,
              parentId: i > 0 ? postDefs[0].parentId : null,
            },
          });
          if (i === 0) {
            postDefs[1].parentId = post.id;
            postDefs[2].parentId = post.id;
          }
        }
      }
    }
    console.log('✅ Forum thread created');
  } catch (e) {
    console.error('❌ Forum thread failed', e);
  }

  // ── 11. Global Announcement ────────────────────────────────────────────────
  try {
    const existing = await prisma.globalAnnouncement.findFirst({
      where: { title: '¡Bienvenidos a NexusLMS!' },
    });
    if (!existing) {
      await prisma.globalAnnouncement.create({
        data: {
          title: '¡Bienvenidos a NexusLMS!',
          message: '¡Bienvenidos a NexusLMS! Explorá nuestros cursos disponibles.',
          type: GlobalAnnouncementType.INFO,
          isActive: true,
          createdBy: adminUser.id,
        },
      });
    }
    console.log('✅ Global announcement created');
  } catch (e) {
    console.error('❌ Global announcement failed', e);
  }

  console.log('\n🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Fatal seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
