import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  CourseStatus,
  EnrollmentType,
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

  // ── 3. Courses (existing 5 + 6 new) ───────────────────────────────────────
  let c1Id = '';
  let c2Id = '';
  let c3Id = '';
  let c4Id = '';
  let c5Id = '';
  // New courses
  let c6Id = '';
  let c7Id = '';
  let c8Id = '';
  let c9Id = '';
  let c10Id = '';
  let c11Id = '';

  try {
    // Course 1 — TypeScript → PAID
    const c1 = await prisma.course.upsert({
      where: { slug: 'typescript-de-cero-a-experto' },
      update: { enrollmentType: EnrollmentType.PAID, status: CourseStatus.PUBLISHED },
      create: {
        title: 'TypeScript de Cero a Experto',
        slug: 'typescript-de-cero-a-experto',
        description:
          'Aprende TypeScript desde los fundamentos hasta técnicas avanzadas en este curso completo.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '29.99',
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c1Id = c1.id;

    // Course 2 — Python → FREE
    const c2 = await prisma.course.upsert({
      where: { slug: 'python-para-data-science' },
      update: { enrollmentType: EnrollmentType.FREE, status: CourseStatus.PUBLISHED },
      create: {
        title: 'Python para Data Science',
        slug: 'python-para-data-science',
        description: 'Domina Python y las principales librerías para ciencia de datos.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        instructorId: adminUser.id,
        categoryId: categories['ciencia-de-datos'] ?? null,
      },
    });
    c2Id = c2.id;

    // Course 3 — Figma → ASSIGNED
    const c3 = await prisma.course.upsert({
      where: { slug: 'diseno-de-interfaces-con-figma' },
      update: { enrollmentType: EnrollmentType.ASSIGNED, status: CourseStatus.PUBLISHED },
      create: {
        title: 'Diseño de Interfaces con Figma',
        slug: 'diseno-de-interfaces-con-figma',
        description: 'Aprende a diseñar interfaces profesionales usando Figma desde cero.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.ASSIGNED,
        price: '19.99',
        instructorId: adminUser.id,
        categoryId: categories['diseno-ux-ui'] ?? null,
      },
    });
    c3Id = c3.id;

    // Course 4 — Machine Learning → CODE
    const c4 = await prisma.course.upsert({
      where: { slug: 'machine-learning-practico' },
      update: { enrollmentType: EnrollmentType.CODE, status: CourseStatus.PUBLISHED },
      create: {
        title: 'Machine Learning Práctico',
        slug: 'machine-learning-practico',
        description: 'Implementa algoritmos de ML con Python, scikit-learn y TensorFlow.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.CODE,
        price: '49.99',
        instructorId: adminUser.id,
        categoryId: categories['inteligencia-artificial'] ?? null,
      },
    });
    c4Id = c4.id;

    // Course 5 — SEO → FREE, now PUBLISHED
    const c5 = await prisma.course.upsert({
      where: { slug: 'seo-y-marketing-de-contenidos' },
      update: { enrollmentType: EnrollmentType.FREE, status: CourseStatus.PUBLISHED },
      create: {
        title: 'SEO y Marketing de Contenidos',
        slug: 'seo-y-marketing-de-contenidos',
        description:
          'Estrategias de SEO y marketing de contenidos para aumentar tu visibilidad online.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        price: '24.99',
        instructorId: adminUser.id,
        categoryId: categories['marketing-digital'] ?? null,
      },
    });
    c5Id = c5.id;

    // Course 6 — React con Next.js → FREE
    const c6 = await prisma.course.upsert({
      where: { slug: 'react-con-nextjs' },
      update: { enrollmentType: EnrollmentType.FREE },
      create: {
        title: 'React con Next.js',
        slug: 'react-con-nextjs',
        description: 'Construye aplicaciones web modernas con React y Next.js desde cero.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c6Id = c6.id;

    // Course 7 — SQL y Bases de Datos → FREE
    const c7 = await prisma.course.upsert({
      where: { slug: 'sql-y-bases-de-datos' },
      update: { enrollmentType: EnrollmentType.FREE },
      create: {
        title: 'SQL y Bases de Datos',
        slug: 'sql-y-bases-de-datos',
        description:
          'Aprende SQL desde los fundamentos y domina el diseño de bases de datos relacionales.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c7Id = c7.id;

    // Course 8 — Docker y DevOps → ASSIGNED
    const c8 = await prisma.course.upsert({
      where: { slug: 'docker-y-devops' },
      update: { enrollmentType: EnrollmentType.ASSIGNED },
      create: {
        title: 'Docker y DevOps',
        slug: 'docker-y-devops',
        description:
          'Domina Docker, Kubernetes y las prácticas DevOps para despliegue de aplicaciones.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.ASSIGNED,
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c8Id = c8.id;

    // Course 9 — Diseño Gráfico con Adobe XD → PAID
    const c9 = await prisma.course.upsert({
      where: { slug: 'diseno-grafico-con-adobe-xd' },
      update: { enrollmentType: EnrollmentType.PAID },
      create: {
        title: 'Diseño Gráfico con Adobe XD',
        slug: 'diseno-grafico-con-adobe-xd',
        description: 'Aprende a crear prototipos y diseños profesionales con Adobe XD.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '24.99',
        instructorId: adminUser.id,
        categoryId: categories['diseno-ux-ui'] ?? null,
      },
    });
    c9Id = c9.id;

    // Course 10 — Estadística para Data Science → CODE
    const c10 = await prisma.course.upsert({
      where: { slug: 'estadistica-para-data-science' },
      update: { enrollmentType: EnrollmentType.CODE },
      create: {
        title: 'Estadística para Data Science',
        slug: 'estadistica-para-data-science',
        description:
          'Fundamentos estadísticos esenciales para ciencia de datos y machine learning.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.CODE,
        instructorId: adminUser.id,
        categoryId: categories['ciencia-de-datos'] ?? null,
      },
    });
    c10Id = c10.id;

    // Course 11 — Redes Neuronales Avanzadas → PAID
    const c11 = await prisma.course.upsert({
      where: { slug: 'redes-neuronales-avanzadas' },
      update: { enrollmentType: EnrollmentType.PAID },
      create: {
        title: 'Redes Neuronales Avanzadas',
        slug: 'redes-neuronales-avanzadas',
        description: 'Arquitecturas avanzadas de deep learning: CNNs, RNNs, Transformers y más.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '59.99',
        instructorId: adminUser.id,
        categoryId: categories['inteligencia-artificial'] ?? null,
      },
    });
    c11Id = c11.id;

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
    // Helper to upsert a module and its lessons, returning lesson IDs
    type LessonSpec = {
      title: string;
      order: number;
      type: LessonType;
      isPreview?: boolean;
      isPublished?: boolean;
    };
    type ModSpec = { title: string; order: number; lessons: LessonSpec[]; isPublished?: boolean };

    async function upsertModules(courseId: string, mods: ModSpec[]): Promise<string[]> {
      const lessonIds: string[] = [];
      for (const mod of mods) {
        const m = await prisma.courseModule.upsert({
          where: { courseId_order: { courseId, order: mod.order } },
          update: {},
          create: {
            courseId,
            title: mod.title,
            order: mod.order,
            isPublished: mod.isPublished ?? true,
          },
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
              isPublished: les.isPublished ?? true,
              content: `Contenido de la lección: ${les.title}`,
            },
          });
          lessonIds.push(l.id);
        }
      }
      return lessonIds;
    }

    if (c1Id) {
      const ids = await upsertModules(c1Id, [
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
      ]);
      c1Lessons.push(...ids);
      quizLessonId = ids[ids.length - 1]; // last lesson is the QUIZ
    }

    if (c2Id) {
      const ids = await upsertModules(c2Id, [
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
      ]);
      c2Lessons.push(...ids);
    }

    if (c3Id) {
      const ids = await upsertModules(c3Id, [
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
      ]);
      c3Lessons.push(...ids);
    }

    if (c4Id) {
      await upsertModules(c4Id, [
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
      ]);
    }

    if (c5Id) {
      await upsertModules(c5Id, [
        {
          title: 'Introducción al SEO',
          order: 1,
          lessons: [
            { title: '¿Qué es el SEO?', order: 1, type: LessonType.TEXT },
            { title: 'Investigación de palabras clave', order: 2, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    // ── New courses ──────────────────────────────────────────────────────────

    if (c6Id) {
      await upsertModules(c6Id, [
        {
          title: 'Fundamentos de React',
          order: 1,
          lessons: [
            { title: 'Introducción a React', order: 1, type: LessonType.TEXT, isPreview: true },
            { title: 'Componentes y props', order: 2, type: LessonType.VIDEO },
            { title: 'Estado y hooks', order: 3, type: LessonType.TEXT },
            { title: 'React Router', order: 4, type: LessonType.VIDEO },
          ],
        },
        {
          title: 'Next.js en Profundidad',
          order: 2,
          lessons: [
            { title: 'App Router y Server Components', order: 1, type: LessonType.TEXT },
            { title: 'Data fetching en Next.js', order: 2, type: LessonType.VIDEO },
            { title: 'Optimización y despliegue', order: 3, type: LessonType.TEXT },
            { title: 'Proyecto: Blog con Next.js', order: 4, type: LessonType.VIDEO },
          ],
        },
      ]);
    }

    if (c7Id) {
      await upsertModules(c7Id, [
        {
          title: 'SQL Básico',
          order: 1,
          lessons: [
            {
              title: 'Introducción a las bases de datos',
              order: 1,
              type: LessonType.TEXT,
              isPreview: true,
            },
            { title: 'SELECT, FROM y WHERE', order: 2, type: LessonType.TEXT },
            { title: 'JOINs y relaciones', order: 3, type: LessonType.VIDEO },
          ],
        },
        {
          title: 'SQL Avanzado',
          order: 2,
          lessons: [
            { title: 'Subconsultas y CTEs', order: 1, type: LessonType.TEXT },
            { title: 'Índices y optimización', order: 2, type: LessonType.VIDEO },
            { title: 'Stored procedures y triggers', order: 3, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    if (c8Id) {
      await upsertModules(c8Id, [
        {
          title: 'Docker Esencial',
          order: 1,
          lessons: [
            { title: '¿Qué es Docker?', order: 1, type: LessonType.TEXT },
            { title: 'Imágenes y contenedores', order: 2, type: LessonType.VIDEO },
            { title: 'Docker Compose', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'DevOps y CI/CD',
          order: 2,
          lessons: [
            { title: 'Pipelines de CI/CD', order: 1, type: LessonType.TEXT },
            { title: 'Kubernetes básico', order: 2, type: LessonType.VIDEO },
            { title: 'Monitoreo y logs', order: 3, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    if (c9Id) {
      await upsertModules(c9Id, [
        {
          title: 'Diseño con Adobe XD',
          order: 1,
          lessons: [
            { title: 'Interfaz de Adobe XD', order: 1, type: LessonType.TEXT },
            { title: 'Wireframing y mockups', order: 2, type: LessonType.VIDEO },
            { title: 'Sistemas de diseño', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Prototipado Avanzado',
          order: 2,
          lessons: [
            { title: 'Animaciones y transiciones', order: 1, type: LessonType.VIDEO },
            { title: 'Pruebas de usabilidad', order: 2, type: LessonType.TEXT },
            { title: 'Exportar y entregar assets', order: 3, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    if (c10Id) {
      await upsertModules(c10Id, [
        {
          title: 'Estadística Descriptiva',
          order: 1,
          lessons: [
            { title: 'Media, mediana y moda', order: 1, type: LessonType.TEXT },
            { title: 'Distribuciones de probabilidad', order: 2, type: LessonType.VIDEO },
            { title: 'Visualización estadística', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Estadística Inferencial',
          order: 2,
          lessons: [
            { title: 'Pruebas de hipótesis', order: 1, type: LessonType.TEXT },
            { title: 'Regresión estadística', order: 2, type: LessonType.VIDEO },
            { title: 'Análisis bayesiano', order: 3, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    if (c11Id) {
      await upsertModules(c11Id, [
        {
          title: 'Redes Convolucionales',
          order: 1,
          lessons: [
            { title: 'CNNs y visión por computadora', order: 1, type: LessonType.TEXT },
            { title: 'Implementación con PyTorch', order: 2, type: LessonType.VIDEO },
            { title: 'Transfer Learning', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Redes Recurrentes',
          order: 2,
          lessons: [
            { title: 'LSTMs y GRUs', order: 1, type: LessonType.TEXT },
            { title: 'NLP con redes recurrentes', order: 2, type: LessonType.VIDEO },
            { title: 'Generación de texto', order: 3, type: LessonType.TEXT },
          ],
        },
        {
          title: 'Transformers y Atención',
          order: 3,
          lessons: [
            { title: 'Mecanismo de atención', order: 1, type: LessonType.TEXT },
            { title: 'Fine-tuning de LLMs', order: 2, type: LessonType.VIDEO },
            { title: 'Proyecto final', order: 3, type: LessonType.TEXT },
          ],
        },
      ]);
    }

    console.log('✅ Modules and lessons created');
  } catch (e) {
    console.error('❌ Modules/Lessons failed', e);
  }

  // ── 5. Quiz (Course 1 Module 3 — Evaluación final) ─────────────────────────
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

  // ── 6. Enrollment Codes ────────────────────────────────────────────────────
  try {
    if (c4Id) {
      await prisma.enrollmentCode.upsert({
        where: { code: 'ML2026' },
        update: {},
        create: { courseId: c4Id, code: 'ML2026', maxUses: 50 },
      });
    }
    if (c10Id) {
      await prisma.enrollmentCode.upsert({
        where: { code: 'STATS2026' },
        update: {},
        create: { courseId: c10Id, code: 'STATS2026', maxUses: 30 },
      });
    }
    console.log('✅ Enrollment codes created');
  } catch (e) {
    console.error('❌ Enrollment codes failed', e);
  }

  // ── 7. Enrollments ─────────────────────────────────────────────────────────
  let enrollC1: { id: string } | null = null;
  let enrollC2: { id: string } | null = null;
  let enrollC3: { id: string } | null = null;

  // FREE courses: c2 (Python), c5 (SEO), c6 (React), c7 (SQL)
  try {
    const now = new Date();

    // ldquiroz enrollments (existing)
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

    // ldquiroz in all FREE courses (c5, c6, c7)
    for (const courseId of [c5Id, c6Id, c7Id].filter(Boolean)) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId } },
        update: {},
        create: { userId: adminUser.id, courseId, status: EnrollmentStatus.ACTIVE },
      });
    }

    // Student enrollments — 3-5 students per course using rotating subsets
    const enrollments: { courseId: string; studentIndices: number[] }[] = [
      { courseId: c1Id, studentIndices: [0, 1, 2, 3, 4] }, // 5 students — PAID
      { courseId: c2Id, studentIndices: [5, 6, 7] }, // 3 students — FREE
      { courseId: c3Id, studentIndices: [0, 1, 2] }, // 3 students — ASSIGNED
      { courseId: c4Id, studentIndices: [0, 1, 2, 3, 4, 5, 6, 7] }, // 8 students — CODE
      { courseId: c5Id, studentIndices: [3, 4, 5] }, // 3 students — FREE
      { courseId: c6Id, studentIndices: [1, 2, 3, 4] }, // 4 students — FREE
      { courseId: c7Id, studentIndices: [6, 7, 8] }, // 3 students — FREE
      { courseId: c8Id, studentIndices: [0, 1, 2] }, // 3 students — ASSIGNED
      { courseId: c9Id, studentIndices: [3, 4, 5] }, // 3 students — PAID
      { courseId: c10Id, studentIndices: [2, 4, 6] }, // 3 students — CODE
      { courseId: c11Id, studentIndices: [1, 3, 5, 7] }, // 4 students — PAID
    ];

    for (const { courseId, studentIndices } of enrollments) {
      if (!courseId) continue;
      for (const idx of studentIndices) {
        const student = studentUsers[idx];
        await prisma.enrollment.upsert({
          where: { userId_courseId: { userId: student.id, courseId } },
          update: {},
          create: { userId: student.id, courseId, status: EnrollmentStatus.ACTIVE },
        });
      }
    }

    console.log('✅ Enrollments created');
  } catch (e) {
    console.error('❌ Enrollments failed', e);
  }

  // ── 8. Lesson Progress (ldquiroz only) ─────────────────────────────────────
  try {
    const now = new Date();

    // Course 1: first 3 lessons (40% of 9)
    if (enrollC1) {
      for (let i = 0; i < 3 && i < c1Lessons.length; i++) {
        await prisma.lessonProgress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId: enrollC1.id, lessonId: c1Lessons[i] } },
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
          where: { enrollmentId_lessonId: { enrollmentId: enrollC2.id, lessonId: c2Lessons[i] } },
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

    // Course 3: all 6 lessons completed
    if (enrollC3) {
      for (const lessonId of c3Lessons) {
        await prisma.lessonProgress.upsert({
          where: { enrollmentId_lessonId: { enrollmentId: enrollC3.id, lessonId } },
          update: {},
          create: { enrollmentId: enrollC3.id, lessonId, startedAt: now, completedAt: now },
        });
      }
    }

    console.log('✅ Lesson progress created');
  } catch (e) {
    console.error('❌ Lesson progress failed', e);
  }

  // ── 9. Announcements ───────────────────────────────────────────────────────
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

  // ── 10. Ratings ────────────────────────────────────────────────────────────
  try {
    if (c3Id) {
      await prisma.courseRating.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c3Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c3Id, score: 90, review: 'Excelente curso' },
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

  // ── 11. Forum Thread ───────────────────────────────────────────────────────
  try {
    if (c1Id && studentUsers.length >= 2) {
      let thread = await prisma.forumThread.findFirst({
        where: { courseId: c1Id, title: '¿Cómo instalar TypeScript?' },
      });
      if (!thread) {
        thread = await prisma.forumThread.create({
          data: { courseId: c1Id, authorId: adminUser.id, title: '¿Cómo instalar TypeScript?' },
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
            'También lo pueden instalar localmente con `npm install --save-dev typescript`. Así cada proyecto usa su propia versión.',
          parentId: null as string | null,
        },
        {
          authorId: studentUsers[1].id,
          content:
            'Para VSCode, instalen la extensión TypeScript Hero para mejor autocompletado. ¡Hace una gran diferencia!',
          parentId: null as string | null,
        },
      ];

      for (let i = 0; i < postDefs.length; i++) {
        const pd = postDefs[i];
        const existing = await prisma.forumPost.findFirst({
          where: { threadId: thread.id, authorId: pd.authorId },
        });
        if (!existing) {
          const post = await prisma.forumPost.create({
            data: {
              threadId: thread.id,
              authorId: pd.authorId,
              content: pd.content,
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

  // ── 12. Global Announcement ────────────────────────────────────────────────
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
