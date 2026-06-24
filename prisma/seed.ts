import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
  CourseStatus,
  CourseLevel,
  EnrollmentType,
  LessonType,
  QuestionType,
  EnrollmentStatus,
  GlobalAnnouncementType,
  CalendarEventType,
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
      update: {
        enrollmentType: EnrollmentType.PAID,
        status: CourseStatus.PUBLISHED,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Fundamentos de tipos en TypeScript',
          'Interfaces, genéricos y tipos avanzados',
          'Decoradores y metadatos',
          'Integración con frameworks modernos',
          'Mejores prácticas y patrones de TypeScript',
        ],
        tags: ['typescript', 'javascript', 'programación', 'backend', 'frontend'],
      },
      create: {
        title: 'TypeScript de Cero a Experto',
        slug: 'typescript-de-cero-a-experto',
        description:
          'Aprende TypeScript desde los fundamentos hasta técnicas avanzadas en este curso completo.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '29.99',
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Fundamentos de tipos en TypeScript',
          'Interfaces, genéricos y tipos avanzados',
          'Decoradores y metadatos',
          'Integración con frameworks modernos',
          'Mejores prácticas y patrones de TypeScript',
        ],
        tags: ['typescript', 'javascript', 'programación', 'backend', 'frontend'],
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c1Id = c1.id;

    // Course 2 — Python → FREE
    const c2 = await prisma.course.upsert({
      where: { slug: 'python-para-data-science' },
      update: {
        enrollmentType: EnrollmentType.FREE,
        status: CourseStatus.PUBLISHED,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Variables, tipos de datos y control de flujo en Python',
          'Operaciones vectoriales con NumPy',
          'Manipulación de datos con Pandas',
          'Limpieza y preparación de datasets',
          'Análisis exploratorio de datos',
        ],
        tags: ['python', 'data-science', 'pandas', 'numpy', 'análisis'],
      },
      create: {
        title: 'Python para Data Science',
        slug: 'python-para-data-science',
        description: 'Domina Python y las principales librerías para ciencia de datos.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Variables, tipos de datos y control de flujo en Python',
          'Operaciones vectoriales con NumPy',
          'Manipulación de datos con Pandas',
          'Limpieza y preparación de datasets',
          'Análisis exploratorio de datos',
        ],
        tags: ['python', 'data-science', 'pandas', 'numpy', 'análisis'],
        instructorId: adminUser.id,
        categoryId: categories['ciencia-de-datos'] ?? null,
      },
    });
    c2Id = c2.id;

    // Course 3 — Figma → ASSIGNED
    const c3 = await prisma.course.upsert({
      where: { slug: 'diseno-de-interfaces-con-figma' },
      update: {
        enrollmentType: EnrollmentType.ASSIGNED,
        status: CourseStatus.PUBLISHED,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Interfaz y herramientas esenciales de Figma',
          'Componentes, variantes y sistemas de diseño',
          'Auto Layout y diseño responsivo',
          'Prototipado interactivo y animaciones',
          'Entrega de assets al equipo de desarrollo',
        ],
        tags: ['figma', 'diseño-ux', 'ui', 'prototipado', 'diseño'],
      },
      create: {
        title: 'Diseño de Interfaces con Figma',
        slug: 'diseno-de-interfaces-con-figma',
        description: 'Aprende a diseñar interfaces profesionales usando Figma desde cero.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.ASSIGNED,
        price: '19.99',
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Interfaz y herramientas esenciales de Figma',
          'Componentes, variantes y sistemas de diseño',
          'Auto Layout y diseño responsivo',
          'Prototipado interactivo y animaciones',
          'Entrega de assets al equipo de desarrollo',
        ],
        tags: ['figma', 'diseño-ux', 'ui', 'prototipado', 'diseño'],
        instructorId: adminUser.id,
        categoryId: categories['diseno-ux-ui'] ?? null,
      },
    });
    c3Id = c3.id;

    // Course 4 — Machine Learning → CODE
    const c4 = await prisma.course.upsert({
      where: { slug: 'machine-learning-practico' },
      update: {
        enrollmentType: EnrollmentType.CODE,
        status: CourseStatus.PUBLISHED,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Fundamentos y tipos de algoritmos de ML',
          'Preparación y limpieza de datos',
          'Algoritmos supervisados con scikit-learn',
          'Árboles de decisión y Random Forest',
          'Redes neuronales básicas con TensorFlow',
        ],
        tags: ['machine-learning', 'python', 'scikit-learn', 'tensorflow', 'ia'],
      },
      create: {
        title: 'Machine Learning Práctico',
        slug: 'machine-learning-practico',
        description: 'Implementa algoritmos de ML con Python, scikit-learn y TensorFlow.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.CODE,
        price: '49.99',
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Fundamentos y tipos de algoritmos de ML',
          'Preparación y limpieza de datos',
          'Algoritmos supervisados con scikit-learn',
          'Árboles de decisión y Random Forest',
          'Redes neuronales básicas con TensorFlow',
        ],
        tags: ['machine-learning', 'python', 'scikit-learn', 'tensorflow', 'ia'],
        instructorId: adminUser.id,
        categoryId: categories['inteligencia-artificial'] ?? null,
      },
    });
    c4Id = c4.id;

    // Course 5 — SEO → FREE, now PUBLISHED
    const c5 = await prisma.course.upsert({
      where: { slug: 'seo-y-marketing-de-contenidos' },
      update: {
        enrollmentType: EnrollmentType.FREE,
        status: CourseStatus.PUBLISHED,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Principios fundamentales del SEO',
          'Investigación y selección de palabras clave',
          'Estrategias de marketing de contenidos',
          'Optimización on-page y off-page',
          'Métricas y análisis de resultados',
        ],
        tags: ['seo', 'marketing', 'contenidos', 'digital', 'google'],
      },
      create: {
        title: 'SEO y Marketing de Contenidos',
        slug: 'seo-y-marketing-de-contenidos',
        description:
          'Estrategias de SEO y marketing de contenidos para aumentar tu visibilidad online.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        price: '24.99',
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Principios fundamentales del SEO',
          'Investigación y selección de palabras clave',
          'Estrategias de marketing de contenidos',
          'Optimización on-page y off-page',
          'Métricas y análisis de resultados',
        ],
        tags: ['seo', 'marketing', 'contenidos', 'digital', 'google'],
        instructorId: adminUser.id,
        categoryId: categories['marketing-digital'] ?? null,
      },
    });
    c5Id = c5.id;

    // Course 6 — React con Next.js → FREE
    const c6 = await prisma.course.upsert({
      where: { slug: 'react-con-nextjs' },
      update: {
        enrollmentType: EnrollmentType.FREE,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Componentes, props y hooks de React',
          'App Router y Server Components de Next.js',
          'Gestión de estado y Context API',
          'Data fetching y optimización de rendimiento',
          'Despliegue en producción con Vercel',
        ],
        tags: ['react', 'nextjs', 'javascript', 'frontend', 'web'],
      },
      create: {
        title: 'React con Next.js',
        slug: 'react-con-nextjs',
        description: 'Construye aplicaciones web modernas con React y Next.js desde cero.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Componentes, props y hooks de React',
          'App Router y Server Components de Next.js',
          'Gestión de estado y Context API',
          'Data fetching y optimización de rendimiento',
          'Despliegue en producción con Vercel',
        ],
        tags: ['react', 'nextjs', 'javascript', 'frontend', 'web'],
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c6Id = c6.id;

    // Course 7 — SQL y Bases de Datos → FREE
    const c7 = await prisma.course.upsert({
      where: { slug: 'sql-y-bases-de-datos' },
      update: {
        enrollmentType: EnrollmentType.FREE,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Fundamentos de bases de datos relacionales',
          'Consultas SELECT, JOIN y subconsultas',
          'Agrupaciones y funciones de agregado',
          'CTEs e índices para optimización',
          'Diseño y normalización de esquemas',
        ],
        tags: ['sql', 'bases-de-datos', 'postgresql', 'backend', 'datos'],
      },
      create: {
        title: 'SQL y Bases de Datos',
        slug: 'sql-y-bases-de-datos',
        description:
          'Aprende SQL desde los fundamentos y domina el diseño de bases de datos relacionales.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.FREE,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Fundamentos de bases de datos relacionales',
          'Consultas SELECT, JOIN y subconsultas',
          'Agrupaciones y funciones de agregado',
          'CTEs e índices para optimización',
          'Diseño y normalización de esquemas',
        ],
        tags: ['sql', 'bases-de-datos', 'postgresql', 'backend', 'datos'],
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c7Id = c7.id;

    // Course 8 — Docker y DevOps → ASSIGNED
    const c8 = await prisma.course.upsert({
      where: { slug: 'docker-y-devops' },
      update: {
        enrollmentType: EnrollmentType.ASSIGNED,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Contenedores Docker e imágenes',
          'Orquestación con Docker Compose',
          'Pipelines de CI/CD automatizados',
          'Kubernetes básico para orquestación',
          'Mejores prácticas de DevOps',
        ],
        tags: ['docker', 'devops', 'kubernetes', 'cicd', 'backend'],
      },
      create: {
        title: 'Docker y DevOps',
        slug: 'docker-y-devops',
        description:
          'Domina Docker, Kubernetes y las prácticas DevOps para despliegue de aplicaciones.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.ASSIGNED,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Contenedores Docker e imágenes',
          'Orquestación con Docker Compose',
          'Pipelines de CI/CD automatizados',
          'Kubernetes básico para orquestación',
          'Mejores prácticas de DevOps',
        ],
        tags: ['docker', 'devops', 'kubernetes', 'cicd', 'backend'],
        instructorId: adminUser.id,
        categoryId: categories['desarrollo-web'] ?? null,
      },
    });
    c8Id = c8.id;

    // Course 9 — Diseño Gráfico con Adobe XD → PAID
    const c9 = await prisma.course.upsert({
      where: { slug: 'diseno-grafico-con-adobe-xd' },
      update: {
        enrollmentType: EnrollmentType.PAID,
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Interfaz y herramientas de Adobe XD',
          'Wireframing y mockups profesionales',
          'Sistemas de diseño y componentes reutilizables',
          'Animaciones y transiciones interactivas',
          'Exportación y entrega de assets al equipo',
        ],
        tags: ['adobe-xd', 'diseño', 'ux', 'prototipado', 'ui'],
      },
      create: {
        title: 'Diseño Gráfico con Adobe XD',
        slug: 'diseno-grafico-con-adobe-xd',
        description: 'Aprende a crear prototipos y diseños profesionales con Adobe XD.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '24.99',
        level: CourseLevel.BEGINNER,
        whatYouWillLearn: [
          'Interfaz y herramientas de Adobe XD',
          'Wireframing y mockups profesionales',
          'Sistemas de diseño y componentes reutilizables',
          'Animaciones y transiciones interactivas',
          'Exportación y entrega de assets al equipo',
        ],
        tags: ['adobe-xd', 'diseño', 'ux', 'prototipado', 'ui'],
        instructorId: adminUser.id,
        categoryId: categories['diseno-ux-ui'] ?? null,
      },
    });
    c9Id = c9.id;

    // Course 10 — Estadística para Data Science → CODE
    const c10 = await prisma.course.upsert({
      where: { slug: 'estadistica-para-data-science' },
      update: {
        enrollmentType: EnrollmentType.CODE,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Estadística descriptiva: medidas de tendencia y dispersión',
          'Distribuciones de probabilidad',
          'Pruebas de hipótesis estadísticas',
          'Regresión estadística aplicada a ML',
          'Análisis bayesiano para ciencia de datos',
        ],
        tags: ['estadística', 'data-science', 'python', 'matemáticas', 'machine-learning'],
      },
      create: {
        title: 'Estadística para Data Science',
        slug: 'estadistica-para-data-science',
        description:
          'Fundamentos estadísticos esenciales para ciencia de datos y machine learning.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.CODE,
        level: CourseLevel.INTERMEDIATE,
        whatYouWillLearn: [
          'Estadística descriptiva: medidas de tendencia y dispersión',
          'Distribuciones de probabilidad',
          'Pruebas de hipótesis estadísticas',
          'Regresión estadística aplicada a ML',
          'Análisis bayesiano para ciencia de datos',
        ],
        tags: ['estadística', 'data-science', 'python', 'matemáticas', 'machine-learning'],
        instructorId: adminUser.id,
        categoryId: categories['ciencia-de-datos'] ?? null,
      },
    });
    c10Id = c10.id;

    // Course 11 — Redes Neuronales Avanzadas → PAID
    const c11 = await prisma.course.upsert({
      where: { slug: 'redes-neuronales-avanzadas' },
      update: {
        enrollmentType: EnrollmentType.PAID,
        level: CourseLevel.ADVANCED,
        whatYouWillLearn: [
          'Redes convolucionales (CNN) para visión por computadora',
          'LSTMs y GRUs para datos secuenciales',
          'Mecanismo de atención y arquitectura Transformer',
          'Fine-tuning de modelos de lenguaje grandes (LLMs)',
          'Despliegue de modelos de deep learning en producción',
        ],
        tags: ['deep-learning', 'pytorch', 'transformers', 'llm', 'ia'],
      },
      create: {
        title: 'Redes Neuronales Avanzadas',
        slug: 'redes-neuronales-avanzadas',
        description: 'Arquitecturas avanzadas de deep learning: CNNs, RNNs, Transformers y más.',
        status: CourseStatus.PUBLISHED,
        enrollmentType: EnrollmentType.PAID,
        price: '59.99',
        level: CourseLevel.ADVANCED,
        whatYouWillLearn: [
          'Redes convolucionales (CNN) para visión por computadora',
          'LSTMs y GRUs para datos secuenciales',
          'Mecanismo de atención y arquitectura Transformer',
          'Fine-tuning de modelos de lenguaje grandes (LLMs)',
          'Despliegue de modelos de deep learning en producción',
        ],
        tags: ['deep-learning', 'pytorch', 'transformers', 'llm', 'ia'],
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
  const c6Lessons: string[] = [];
  const c7Lessons: string[] = [];
  const c8Lessons: string[] = [];
  let quizLessonId = '';
  let c6QuizLessonId = '';
  let c7QuizLessonId = '';

  try {
    // Helper to upsert a module and its lessons, returning lesson IDs
    type LessonSpec = {
      title: string;
      order: number;
      type: LessonType;
      duration: number;
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
            update: { type: les.type, title: les.title, duration: les.duration },
            create: {
              moduleId: m.id,
              title: les.title,
              order: les.order,
              type: les.type,
              duration: les.duration,
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
            {
              title: '¿Qué es TypeScript?',
              order: 1,
              type: LessonType.TEXT,
              duration: 420,
              isPreview: true,
            },
            { title: 'Tipos básicos', order: 2, type: LessonType.TEXT, duration: 480 },
            { title: 'Funciones tipadas', order: 3, type: LessonType.VIDEO, duration: 900 },
          ],
        },
        {
          title: 'Tipos Avanzados',
          order: 2,
          lessons: [
            { title: 'Interfaces y Types', order: 1, type: LessonType.TEXT, duration: 450 },
            { title: 'Genéricos', order: 2, type: LessonType.VIDEO, duration: 1200 },
            { title: 'Decoradores', order: 3, type: LessonType.TEXT, duration: 390 },
          ],
        },
        {
          title: 'Proyecto Final',
          order: 3,
          lessons: [
            { title: 'Arquitectura del proyecto', order: 1, type: LessonType.TEXT, duration: 360 },
            { title: 'Implementación', order: 2, type: LessonType.VIDEO, duration: 1500 },
            { title: 'Evaluación final', order: 3, type: LessonType.QUIZ, duration: 450 },
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
            { title: 'Variables y tipos de datos', order: 1, type: LessonType.TEXT, duration: 420 },
            { title: 'Control de flujo', order: 2, type: LessonType.TEXT, duration: 360 },
            { title: 'Funciones en Python', order: 3, type: LessonType.VIDEO, duration: 900 },
          ],
        },
        {
          title: 'Pandas y NumPy',
          order: 2,
          lessons: [
            { title: 'NumPy arrays', order: 1, type: LessonType.TEXT, duration: 480 },
            { title: 'DataFrames con Pandas', order: 2, type: LessonType.VIDEO, duration: 1200 },
            // index [5]: ASSIGNMENT lesson for Fix 3
            {
              title: 'Proyecto: Análisis de datos con Pandas',
              order: 3,
              type: LessonType.ASSIGNMENT,
              duration: 2700,
            },
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
            { title: 'Interfaz de Figma', order: 1, type: LessonType.TEXT, duration: 420 },
            { title: 'Componentes y variantes', order: 2, type: LessonType.VIDEO, duration: 1200 },
            { title: 'Auto Layout', order: 3, type: LessonType.TEXT, duration: 360 },
          ],
        },
        {
          title: 'Prototipado',
          order: 2,
          lessons: [
            { title: 'Conexiones de prototipo', order: 1, type: LessonType.TEXT, duration: 390 },
            { title: 'Animaciones en Figma', order: 2, type: LessonType.VIDEO, duration: 1500 },
            { title: 'Entrega al desarrollador', order: 3, type: LessonType.TEXT, duration: 300 },
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
            {
              title: '¿Qué es el Machine Learning?',
              order: 1,
              type: LessonType.TEXT,
              duration: 480,
            },
            { title: 'Tipos de algoritmos', order: 2, type: LessonType.TEXT, duration: 420 },
            { title: 'Preparación de datos', order: 3, type: LessonType.VIDEO, duration: 1200 },
          ],
        },
        {
          title: 'Algoritmos Supervisados',
          order: 2,
          lessons: [
            { title: 'Regresión lineal', order: 1, type: LessonType.TEXT, duration: 450 },
            { title: 'Árboles de decisión', order: 2, type: LessonType.VIDEO, duration: 1500 },
            { title: 'Random Forest', order: 3, type: LessonType.TEXT, duration: 390 },
          ],
        },
        {
          title: 'Deep Learning',
          order: 3,
          lessons: [
            { title: 'Redes neuronales', order: 1, type: LessonType.TEXT, duration: 480 },
            { title: 'TensorFlow básico', order: 2, type: LessonType.VIDEO, duration: 1800 },
            { title: 'Proyecto final de ML', order: 3, type: LessonType.TEXT, duration: 360 },
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
            { title: '¿Qué es el SEO?', order: 1, type: LessonType.TEXT, duration: 420 },
            {
              title: 'Investigación de palabras clave',
              order: 2,
              type: LessonType.TEXT,
              duration: 480,
            },
          ],
        },
      ]);
    }

    // ── New courses ──────────────────────────────────────────────────────────

    if (c6Id) {
      const ids = await upsertModules(c6Id, [
        {
          title: 'Fundamentos de React',
          order: 1,
          lessons: [
            {
              title: 'Introducción a React',
              order: 1,
              type: LessonType.TEXT,
              duration: 420,
              isPreview: true,
            },
            { title: 'Componentes y props', order: 2, type: LessonType.VIDEO, duration: 900 },
            { title: 'Estado y hooks', order: 3, type: LessonType.TEXT, duration: 480 },
            { title: 'React Router', order: 4, type: LessonType.VIDEO, duration: 1200 },
          ],
        },
        {
          title: 'Next.js en Profundidad',
          order: 2,
          lessons: [
            {
              title: 'App Router y Server Components',
              order: 1,
              type: LessonType.TEXT,
              duration: 450,
            },
            { title: 'Data fetching en Next.js', order: 2, type: LessonType.VIDEO, duration: 1500 },
            { title: 'Optimización y despliegue', order: 3, type: LessonType.TEXT, duration: 390 },
            // index [7]: QUIZ lesson for Fix 2
            {
              title: 'Evaluación: React y Next.js',
              order: 4,
              type: LessonType.QUIZ,
              duration: 480,
            },
          ],
        },
      ]);
      c6Lessons.push(...ids);
      c6QuizLessonId = ids[ids.length - 1];
    }

    if (c7Id) {
      const ids = await upsertModules(c7Id, [
        {
          title: 'SQL Básico',
          order: 1,
          lessons: [
            {
              title: 'Introducción a las bases de datos',
              order: 1,
              type: LessonType.TEXT,
              duration: 420,
              isPreview: true,
            },
            { title: 'SELECT, FROM y WHERE', order: 2, type: LessonType.TEXT, duration: 480 },
            { title: 'JOINs y relaciones', order: 3, type: LessonType.VIDEO, duration: 1200 },
          ],
        },
        {
          title: 'SQL Avanzado',
          order: 2,
          lessons: [
            { title: 'Subconsultas y CTEs', order: 1, type: LessonType.TEXT, duration: 450 },
            { title: 'Índices y optimización', order: 2, type: LessonType.VIDEO, duration: 1500 },
            // index [5]: QUIZ lesson for Fix 2
            { title: 'Evaluación final: SQL', order: 3, type: LessonType.QUIZ, duration: 420 },
          ],
        },
      ]);
      c7Lessons.push(...ids);
      c7QuizLessonId = ids[ids.length - 1];
    }

    if (c8Id) {
      const ids = await upsertModules(c8Id, [
        {
          title: 'Docker Esencial',
          order: 1,
          lessons: [
            { title: '¿Qué es Docker?', order: 1, type: LessonType.TEXT, duration: 420 },
            { title: 'Imágenes y contenedores', order: 2, type: LessonType.VIDEO, duration: 1200 },
            { title: 'Docker Compose', order: 3, type: LessonType.TEXT, duration: 480 },
          ],
        },
        {
          title: 'DevOps y CI/CD',
          order: 2,
          lessons: [
            { title: 'Pipelines de CI/CD', order: 1, type: LessonType.TEXT, duration: 450 },
            { title: 'Kubernetes básico', order: 2, type: LessonType.VIDEO, duration: 1800 },
            // index [5]: ASSIGNMENT lesson for Fix 3
            {
              title: 'Proyecto práctico DevOps',
              order: 3,
              type: LessonType.ASSIGNMENT,
              duration: 3600,
            },
          ],
        },
      ]);
      c8Lessons.push(...ids);
    }

    if (c9Id) {
      await upsertModules(c9Id, [
        {
          title: 'Diseño con Adobe XD',
          order: 1,
          lessons: [
            { title: 'Interfaz de Adobe XD', order: 1, type: LessonType.TEXT, duration: 420 },
            { title: 'Wireframing y mockups', order: 2, type: LessonType.VIDEO, duration: 1200 },
            { title: 'Sistemas de diseño', order: 3, type: LessonType.TEXT, duration: 390 },
          ],
        },
        {
          title: 'Prototipado Avanzado',
          order: 2,
          lessons: [
            {
              title: 'Animaciones y transiciones',
              order: 1,
              type: LessonType.VIDEO,
              duration: 1500,
            },
            { title: 'Pruebas de usabilidad', order: 2, type: LessonType.TEXT, duration: 360 },
            { title: 'Exportar y entregar assets', order: 3, type: LessonType.TEXT, duration: 300 },
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
            { title: 'Media, mediana y moda', order: 1, type: LessonType.TEXT, duration: 450 },
            {
              title: 'Distribuciones de probabilidad',
              order: 2,
              type: LessonType.VIDEO,
              duration: 1200,
            },
            { title: 'Visualización estadística', order: 3, type: LessonType.TEXT, duration: 390 },
          ],
        },
        {
          title: 'Estadística Inferencial',
          order: 2,
          lessons: [
            { title: 'Pruebas de hipótesis', order: 1, type: LessonType.TEXT, duration: 480 },
            { title: 'Regresión estadística', order: 2, type: LessonType.VIDEO, duration: 1500 },
            { title: 'Análisis bayesiano', order: 3, type: LessonType.TEXT, duration: 420 },
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
            {
              title: 'CNNs y visión por computadora',
              order: 1,
              type: LessonType.TEXT,
              duration: 480,
            },
            {
              title: 'Implementación con PyTorch',
              order: 2,
              type: LessonType.VIDEO,
              duration: 1800,
            },
            { title: 'Transfer Learning', order: 3, type: LessonType.TEXT, duration: 420 },
          ],
        },
        {
          title: 'Redes Recurrentes',
          order: 2,
          lessons: [
            { title: 'LSTMs y GRUs', order: 1, type: LessonType.TEXT, duration: 450 },
            {
              title: 'NLP con redes recurrentes',
              order: 2,
              type: LessonType.VIDEO,
              duration: 1500,
            },
            { title: 'Generación de texto', order: 3, type: LessonType.TEXT, duration: 390 },
          ],
        },
        {
          title: 'Transformers y Atención',
          order: 3,
          lessons: [
            { title: 'Mecanismo de atención', order: 1, type: LessonType.TEXT, duration: 480 },
            { title: 'Fine-tuning de LLMs', order: 2, type: LessonType.VIDEO, duration: 1800 },
            { title: 'Proyecto final', order: 3, type: LessonType.TEXT, duration: 360 },
          ],
        },
      ]);
    }

    console.log('✅ Modules and lessons created');
  } catch (e) {
    console.error('❌ Modules/Lessons failed', e);
  }

  // ── 5. Quizzes (c1, c6, c7) ───────────────────────────────────────────────
  try {
    // Quiz helper — creates settings + questions for a quiz lesson
    type OptionDef = { text: string; isCorrect: boolean; order: number };
    type QuestionDef = { text: string; type: QuestionType; order: number; options: OptionDef[] };

    async function upsertQuiz(
      lessonId: string,
      settings: { passingScore: number; maxAttempts: number; shuffleQuestions: boolean },
      questions: QuestionDef[],
    ): Promise<void> {
      await prisma.quizSettings.upsert({
        where: { lessonId },
        update: {},
        create: {
          lessonId,
          passingScore: settings.passingScore,
          maxAttempts: settings.maxAttempts,
          blocksProgress: false,
          shuffleQuestions: settings.shuffleQuestions,
        },
      });
      for (const qDef of questions) {
        const q = await prisma.question.upsert({
          where: { lessonId_order: { lessonId, order: qDef.order } },
          update: {},
          create: { lessonId, text: qDef.text, type: qDef.type, order: qDef.order, points: 1 },
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
    }

    // Course 1 quiz — TypeScript (original)
    if (quizLessonId) {
      await upsertQuiz(quizLessonId, { passingScore: 70, maxAttempts: 3, shuffleQuestions: true }, [
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
      ]);
      console.log('✅ Quiz c1 created');
    }

    // Course 6 quiz — React y Next.js (Fix 2)
    if (c6QuizLessonId) {
      await upsertQuiz(
        c6QuizLessonId,
        { passingScore: 70, maxAttempts: 3, shuffleQuestions: true },
        [
          {
            text: '¿Qué hook de React se usa para manejar efectos secundarios?',
            type: QuestionType.SINGLE_CHOICE,
            order: 1,
            options: [
              { text: 'useEffect', isCorrect: true, order: 1 },
              { text: 'useState', isCorrect: false, order: 2 },
              { text: 'useContext', isCorrect: false, order: 3 },
              { text: 'useReducer', isCorrect: false, order: 4 },
            ],
          },
          {
            text: '¿Cuál es la diferencia entre Server Components y Client Components en Next.js?',
            type: QuestionType.SINGLE_CHOICE,
            order: 2,
            options: [
              {
                text: 'Server Components se ejecutan en el servidor y no pueden usar hooks de estado',
                isCorrect: true,
                order: 1,
              },
              { text: 'Client Components no pueden acceder al DOM', isCorrect: false, order: 2 },
              { text: 'Server Components solo existen en Next.js 12', isCorrect: false, order: 3 },
              { text: 'No hay diferencia funcional', isCorrect: false, order: 4 },
            ],
          },
          {
            text: 'En React, las props son inmutables desde la perspectiva del componente hijo.',
            type: QuestionType.TRUE_FALSE,
            order: 3,
            options: [
              { text: 'Verdadero', isCorrect: true, order: 1 },
              { text: 'Falso', isCorrect: false, order: 2 },
            ],
          },
          {
            text: '¿Cuál directiva se usa en Next.js App Router para marcar un componente como cliente?',
            type: QuestionType.SINGLE_CHOICE,
            order: 4,
            options: [
              { text: '"use client"', isCorrect: true, order: 1 },
              { text: '"use server"', isCorrect: false, order: 2 },
              { text: '"client-only"', isCorrect: false, order: 3 },
              { text: '"browser-only"', isCorrect: false, order: 4 },
            ],
          },
        ],
      );
      console.log('✅ Quiz c6 created');
    }

    // Course 7 quiz — SQL (Fix 2)
    if (c7QuizLessonId) {
      await upsertQuiz(
        c7QuizLessonId,
        { passingScore: 70, maxAttempts: 3, shuffleQuestions: true },
        [
          {
            text: '¿Qué cláusula SQL se usa para filtrar grupos después de un GROUP BY?',
            type: QuestionType.SINGLE_CHOICE,
            order: 1,
            options: [
              { text: 'HAVING', isCorrect: true, order: 1 },
              { text: 'WHERE', isCorrect: false, order: 2 },
              { text: 'FILTER', isCorrect: false, order: 3 },
              { text: 'ON', isCorrect: false, order: 4 },
            ],
          },
          {
            text: '¿Qué tipo de JOIN devuelve solo las filas que tienen coincidencia en ambas tablas?',
            type: QuestionType.SINGLE_CHOICE,
            order: 2,
            options: [
              { text: 'INNER JOIN', isCorrect: true, order: 1 },
              { text: 'LEFT JOIN', isCorrect: false, order: 2 },
              { text: 'FULL OUTER JOIN', isCorrect: false, order: 3 },
              { text: 'CROSS JOIN', isCorrect: false, order: 4 },
            ],
          },
          {
            text: 'Un índice en una columna siempre mejora el rendimiento de las consultas.',
            type: QuestionType.TRUE_FALSE,
            order: 3,
            options: [
              { text: 'Verdadero', isCorrect: false, order: 1 },
              { text: 'Falso', isCorrect: true, order: 2 },
            ],
          },
          {
            text: '¿Qué es un CTE (Common Table Expression) en SQL?',
            type: QuestionType.SINGLE_CHOICE,
            order: 4,
            options: [
              {
                text: 'Una consulta temporal con nombre definida con WITH',
                isCorrect: true,
                order: 1,
              },
              { text: 'Un tipo de índice compuesto', isCorrect: false, order: 2 },
              { text: 'Una clave foránea virtual', isCorrect: false, order: 3 },
              { text: 'Un procedimiento almacenado', isCorrect: false, order: 4 },
            ],
          },
        ],
      );
      console.log('✅ Quiz c7 created');
    }
  } catch (e) {
    console.error('❌ Quizzes failed', e);
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
  let enrollAdminC5: { id: string } | null = null;
  let enrollAdminC6: { id: string } | null = null;
  let enrollAdminC7: { id: string } | null = null;

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

    // ldquiroz in all FREE courses (c5, c6, c7) — track IDs for lesson progress
    if (c5Id) {
      enrollAdminC5 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c5Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c5Id, status: EnrollmentStatus.ACTIVE },
      });
    }
    if (c6Id) {
      enrollAdminC6 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c6Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c6Id, status: EnrollmentStatus.ACTIVE },
      });
    }
    if (c7Id) {
      enrollAdminC7 = await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c7Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c7Id, status: EnrollmentStatus.ACTIVE },
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

  // ── 8. Lesson Progress — All enrollments (Fix 1) ──────────────────────────
  try {
    const now = new Date();

    // Build lesson ID map for every course
    // Use tracked arrays where available; query DB for the rest
    const courseLessons: Record<string, string[]> = {};
    if (c1Id && c1Lessons.length) courseLessons[c1Id] = c1Lessons;
    if (c2Id && c2Lessons.length) courseLessons[c2Id] = c2Lessons;
    if (c3Id && c3Lessons.length) courseLessons[c3Id] = c3Lessons;
    if (c6Id && c6Lessons.length) courseLessons[c6Id] = c6Lessons;
    if (c7Id && c7Lessons.length) courseLessons[c7Id] = c7Lessons;
    if (c8Id && c8Lessons.length) courseLessons[c8Id] = c8Lessons;

    for (const courseId of [c4Id, c5Id, c9Id, c10Id, c11Id].filter(Boolean)) {
      const lessons = await prisma.lesson.findMany({
        where: { module: { courseId }, isPublished: true },
        orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
        select: { id: true },
      });
      courseLessons[courseId] = lessons.map((l) => l.id);
    }

    // Admin enrollments for c5, c6, c7 — ~50% progress
    for (const [courseId, enrollment] of [
      [c5Id, enrollAdminC5],
      [c6Id, enrollAdminC6],
      [c7Id, enrollAdminC7],
    ] as [string, { id: string } | null][]) {
      if (!courseId || !enrollment) continue;
      const lessonIds = courseLessons[courseId] ?? [];
      const count = Math.ceil(lessonIds.length * 0.5);
      if (count === 0) continue;
      await prisma.lessonProgress.createMany({
        data: lessonIds.slice(0, count).map((lessonId) => ({
          enrollmentId: enrollment.id,
          lessonId,
          startedAt: now,
          completedAt: now,
        })),
        skipDuplicates: true,
      });
    }

    // Student enrollments with varied progress tiers
    // tier 0 (i % 3 === 0): 0% — no records
    // tier 1 (i % 3 === 1): ~40% — first lessons completed
    // tier 2 (i % 3 === 2): ~85% — most lessons completed
    const studentEnrollmentDefs: { courseId: string; studentIndices: number[] }[] = [
      { courseId: c1Id, studentIndices: [0, 1, 2, 3, 4] },
      { courseId: c2Id, studentIndices: [5, 6, 7] },
      { courseId: c3Id, studentIndices: [0, 1, 2] },
      { courseId: c4Id, studentIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
      { courseId: c5Id, studentIndices: [3, 4, 5] },
      { courseId: c6Id, studentIndices: [1, 2, 3, 4] },
      { courseId: c7Id, studentIndices: [6, 7, 8] },
      { courseId: c8Id, studentIndices: [0, 1, 2] },
      { courseId: c9Id, studentIndices: [3, 4, 5] },
      { courseId: c10Id, studentIndices: [2, 4, 6] },
      { courseId: c11Id, studentIndices: [1, 3, 5, 7] },
    ];

    for (const { courseId, studentIndices } of studentEnrollmentDefs) {
      if (!courseId) continue;
      const lessonIds = courseLessons[courseId] ?? [];
      if (lessonIds.length === 0) continue;

      for (let i = 0; i < studentIndices.length; i++) {
        const student = studentUsers[studentIndices[i]];
        const enrollment = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: student.id, courseId } },
        });
        if (!enrollment) continue;

        const tier = i % 3;
        if (tier === 0) continue; // 0% progress

        const count =
          tier === 1 ? Math.ceil(lessonIds.length * 0.4) : Math.ceil(lessonIds.length * 0.85);

        await prisma.lessonProgress.createMany({
          data: lessonIds.slice(0, count).map((lessonId) => ({
            enrollmentId: enrollment.id,
            lessonId,
            startedAt: now,
            completedAt: now,
          })),
          skipDuplicates: true,
        });
      }
    }

    console.log('✅ All-enrollments lesson progress created');
  } catch (e) {
    console.error('❌ All-enrollments lesson progress failed', e);
  }

  // ── 9. Lesson Progress (ldquiroz c1/c2/c3) ────────────────────────────────
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

  // ── 10. Assignment Settings (Fix 3) ───────────────────────────────────────
  try {
    // c2Lessons[5] = "Proyecto: Análisis de datos con Pandas" (ASSIGNMENT)
    const c2AssignmentLessonId = c2Lessons[5];
    if (c2AssignmentLessonId) {
      await prisma.assignmentSettings.upsert({
        where: { lessonId: c2AssignmentLessonId },
        update: {},
        create: {
          lessonId: c2AssignmentLessonId,
          maxScore: 100,
          passingScore: 60,
          allowLateSubmission: true,
          maxAttempts: 2,
        },
      });
    }

    // c8Lessons[5] = "Proyecto práctico DevOps" (ASSIGNMENT)
    const c8AssignmentLessonId = c8Lessons[5];
    if (c8AssignmentLessonId) {
      await prisma.assignmentSettings.upsert({
        where: { lessonId: c8AssignmentLessonId },
        update: {},
        create: {
          lessonId: c8AssignmentLessonId,
          maxScore: 100,
          passingScore: 70,
          allowLateSubmission: false,
          maxAttempts: 1,
        },
      });
    }

    console.log('✅ Assignment settings created');
  } catch (e) {
    console.error('❌ Assignment settings failed', e);
  }

  // ── 11. Announcements ─────────────────────────────────────────────────────
  try {
    // Course 1 — original announcements
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

    // Course 6 — React (Fix 6)
    if (c6Id) {
      const existing = await prisma.announcement.findFirst({
        where: { courseId: c6Id, title: 'Bienvenidos a React con Next.js' },
      });
      if (!existing) {
        await prisma.announcement.create({
          data: {
            courseId: c6Id,
            instructorId: adminUser.id,
            title: 'Bienvenidos a React con Next.js',
            body: '¡Bienvenidos al curso de React con Next.js! Aprenderán a construir aplicaciones web modernas con las últimas características del framework.',
          },
        });
      }
    }

    // Course 7 — SQL (Fix 6)
    if (c7Id) {
      const existing = await prisma.announcement.findFirst({
        where: { courseId: c7Id, title: 'Bienvenidos a SQL y Bases de Datos' },
      });
      if (!existing) {
        await prisma.announcement.create({
          data: {
            courseId: c7Id,
            instructorId: adminUser.id,
            title: 'Bienvenidos a SQL y Bases de Datos',
            body: '¡Bienvenidos! En este curso dominarán SQL desde consultas básicas hasta técnicas avanzadas de optimización. ¡Prepárense para escribir consultas eficientes!',
          },
        });
      }
    }

    console.log('✅ Announcements created');
  } catch (e) {
    console.error('❌ Announcements failed', e);
  }

  // ── 12. Ratings ────────────────────────────────────────────────────────────
  try {
    // Original: c3 (admin) + c1 (students 0-2)
    if (c3Id) {
      await prisma.courseRating.upsert({
        where: { userId_courseId: { userId: adminUser.id, courseId: c3Id } },
        update: {},
        create: { userId: adminUser.id, courseId: c3Id, score: 90, review: 'Excelente curso' },
      });
    }

    const c1Scores = [85, 90, 75];
    for (let i = 0; i < 3 && i < studentUsers.length; i++) {
      if (c1Id) {
        await prisma.courseRating.upsert({
          where: { userId_courseId: { userId: studentUsers[i].id, courseId: c1Id } },
          update: {},
          create: { userId: studentUsers[i].id, courseId: c1Id, score: c1Scores[i] },
        });
      }
    }

    // c2 ratings from enrolled students [5, 6, 7] (Fix 4)
    const c2RatingDefs = [
      { idx: 5, score: 80, review: 'Muy buen curso de Python para ciencia de datos' },
      { idx: 6, score: 88, review: 'Pandas y NumPy muy bien explicados' },
      { idx: 7, score: 75 },
    ];
    for (const { idx, score, review } of c2RatingDefs) {
      if (c2Id) {
        await prisma.courseRating.upsert({
          where: { userId_courseId: { userId: studentUsers[idx].id, courseId: c2Id } },
          update: {},
          create: {
            userId: studentUsers[idx].id,
            courseId: c2Id,
            score,
            ...(review ? { review } : {}),
          },
        });
      }
    }

    // c6 ratings from enrolled students [1, 2, 3, 4] (Fix 4)
    const c6RatingDefs = [
      { idx: 1, score: 92, review: 'El App Router de Next.js está muy bien explicado' },
      { idx: 2, score: 78 },
      { idx: 3, score: 95, review: 'Excelente contenido de React y Next.js' },
      { idx: 4, score: 83 },
    ];
    for (const { idx, score, review } of c6RatingDefs) {
      if (c6Id) {
        await prisma.courseRating.upsert({
          where: { userId_courseId: { userId: studentUsers[idx].id, courseId: c6Id } },
          update: {},
          create: {
            userId: studentUsers[idx].id,
            courseId: c6Id,
            score,
            ...(review ? { review } : {}),
          },
        });
      }
    }

    // c7 ratings from enrolled students [6, 7, 8] (Fix 4)
    const c7RatingDefs = [
      { idx: 6, score: 77 },
      { idx: 7, score: 91, review: 'Los JOINs y CTEs quedaron muy claros' },
      { idx: 8, score: 85, review: 'Buen curso de SQL con ejemplos prácticos' },
    ];
    for (const { idx, score, review } of c7RatingDefs) {
      if (c7Id) {
        await prisma.courseRating.upsert({
          where: { userId_courseId: { userId: studentUsers[idx].id, courseId: c7Id } },
          update: {},
          create: {
            userId: studentUsers[idx].id,
            courseId: c7Id,
            score,
            ...(review ? { review } : {}),
          },
        });
      }
    }

    console.log('✅ Ratings created');
  } catch (e) {
    console.error('❌ Ratings failed', e);
  }

  // ── 13. Forum Threads ─────────────────────────────────────────────────────
  try {
    // Helper to upsert a thread + posts
    async function upsertForumThread(
      courseId: string,
      authorId: string,
      threadTitle: string,
      postDefs: { authorId: string; content: string }[],
    ): Promise<void> {
      let thread = await prisma.forumThread.findFirst({
        where: { courseId, title: threadTitle },
      });
      if (!thread) {
        thread = await prisma.forumThread.create({
          data: { courseId, authorId, title: threadTitle },
        });
      }
      for (const pd of postDefs) {
        const existing = await prisma.forumPost.findFirst({
          where: { threadId: thread.id, authorId: pd.authorId },
        });
        if (!existing) {
          await prisma.forumPost.create({
            data: { threadId: thread.id, authorId: pd.authorId, content: pd.content },
          });
        }
      }
    }

    // Course 1 — original thread
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

    // Course 6 — React (Fix 5)
    if (c6Id && studentUsers.length >= 3) {
      await upsertForumThread(
        c6Id,
        adminUser.id,
        '¿Cuándo usar Server Components vs Client Components?',
        [
          {
            authorId: adminUser.id,
            content:
              'Usen Server Components por defecto. Solo cambien a Client Components cuando necesiten interactividad, hooks de estado (useState, useEffect) o acceso a APIs del browser.',
          },
          {
            authorId: studentUsers[1].id,
            content:
              '¿Y qué pasa con los formularios? ¿Se pueden manejar en Server Components con Server Actions?',
          },
          {
            authorId: studentUsers[2].id,
            content:
              'Sí, con Server Actions de Next.js 14+ pueden manejar formularios sin JavaScript en el cliente. Es una de las mejoras más importantes del App Router.',
          },
        ],
      );
    }

    // Course 7 — SQL (Fix 5)
    if (c7Id && studentUsers.length >= 8) {
      await upsertForumThread(c7Id, adminUser.id, '¿Cuándo conviene usar un índice en SQL?', [
        {
          authorId: adminUser.id,
          content:
            'Los índices mejoran las consultas SELECT con WHERE o JOIN, pero ralentizan INSERT, UPDATE y DELETE porque el índice también se actualiza. Úsenlos en columnas de búsqueda frecuente.',
        },
        {
          authorId: studentUsers[6].id,
          content:
            'Entendido. ¿Hay alguna regla sobre cuántos índices son demasiados en una tabla?',
        },
        {
          authorId: studentUsers[7].id,
          content:
            'Depende del patrón de uso. En tablas con muchos writes eviten índices innecesarios. En tablas de solo lectura pueden ser muy agresivos con los índices.',
        },
      ]);
    }

    console.log('✅ Forum threads created');
  } catch (e) {
    console.error('❌ Forum threads failed', e);
  }

  // ── 14. Certificate (Fix 7) ───────────────────────────────────────────────
  try {
    if (enrollC3 && c3Id) {
      await prisma.certificate.upsert({
        where: { enrollmentId: enrollC3.id },
        update: {},
        create: {
          userId: adminUser.id,
          courseId: c3Id,
          enrollmentId: enrollC3.id,
          certificateCode: 'CERT-FIGMA-2026-LDQUIROZ',
          finalGrade: 92,
        },
      });
      console.log('✅ Certificate created');
    }
  } catch (e) {
    console.error('❌ Certificate failed', e);
  }

  // ── 15. Calendar Events (Fix 8) ───────────────────────────────────────────
  try {
    const now = new Date();
    const calendarDefs = [
      { courseId: c1Id, title: 'Inicio: TypeScript de Cero a Experto' },
      { courseId: c6Id, title: 'Inicio: React con Next.js' },
      { courseId: c7Id, title: 'Inicio: SQL y Bases de Datos' },
    ];
    for (const { courseId, title } of calendarDefs) {
      if (!courseId) continue;
      const existing = await prisma.calendarEvent.findFirst({
        where: { userId: adminUser.id, courseId, type: CalendarEventType.COURSE_START },
      });
      if (!existing) {
        await prisma.calendarEvent.create({
          data: {
            userId: adminUser.id,
            courseId,
            title,
            type: CalendarEventType.COURSE_START,
            startDate: now,
            allDay: true,
          },
        });
      }
    }
    console.log('✅ Calendar events created');
  } catch (e) {
    console.error('❌ Calendar events failed', e);
  }

  // ── 16. Global Announcement ────────────────────────────────────────────────
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
