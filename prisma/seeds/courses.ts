import type { PrismaClient } from '@prisma/client';
import { CourseStatus, CourseLevel, EnrollmentType, LessonType } from '@prisma/client';
import type { UsersMap, CategorySlug } from './users';

// ── exported types ────────────────────────────────────────────────────────────

export const COURSE_SLUGS = [
  'typescript-avanzado',
  'python-data-science',
  'diseno-ux-ui-figma',
  'machine-learning-python',
  'react-nextjs-fullstack',
  'sql-postgresql-practico',
  'docker-kubernetes-devops',
  'deep-learning-redes-neuronales',
  'marketing-digital-seo',
  'ciberseguridad-fundamentos',
  'gestion-agil-scrum',
  'ios-swift-desarrollo',
] as const;

export type CourseSlug = (typeof COURSE_SLUGS)[number];

/** slug → courseId */
export type CoursesMap = Record<CourseSlug, string>;

export interface ModulesAndLessonsMap {
  /** courseId → ordered array of all 12 lessonIds */
  courseLessons: Record<string, string[]>;
  /** courseId → lessonId of the QUIZ (last lesson of last module) */
  quizLessons: Record<string, string>;
  /** courseId → lessonId of the ASSIGNMENT (module 2, c1/c4/c5/c8 only) */
  assignmentLessons: Record<string, string>;
}

// ── private content helpers ───────────────────────────────────────────────────

function tc(title: string): string {
  return [
    `En esta lección exploraremos ${title.toLowerCase()} con ejemplos prácticos y reales. Comenzaremos con los conceptos teóricos esenciales, construyendo una base sólida antes de avanzar a temas más complejos.`,
    `Trabajaremos con casos de uso del mundo real que ilustran cómo se aplica este conocimiento en proyectos profesionales. Verás código funcional, comparaciones y buenas prácticas que marcan la diferencia en el trabajo diario.`,
    `Al finalizar esta lección tendrás las competencias necesarias para continuar con el siguiente tema. Te recomendamos tomar notas y practicar los ejercicios para afianzar lo aprendido.`,
  ].join('\n\n');
}

function vc(title: string): string {
  return `Video: ${title}. Sigue los pasos del instructor en tiempo real para reforzar los conceptos aprendidos en las lecciones de texto anteriores.`;
}

function ac(title: string): string {
  return `Proyecto práctico: ${title}. Implementa una solución completa siguiendo los requisitos del módulo. Documenta tu proceso y sube el código fuente al repositorio para su revisión.`;
}

const QUIZ_CONTENT =
  'Evaluación de conocimientos del módulo. Lee cada pregunta con cuidado antes de responder. Necesitas un mínimo de 70 puntos para aprobar.';

// ── private spec types ────────────────────────────────────────────────────────

type InstructorKey = 'i1' | 'i2' | 'i3';

type LessonSpec = {
  title: string;
  type: LessonType;
  duration: number;
  isPreview?: boolean;
  readingTime?: number;
};

type ModuleSpec = {
  title: string;
  lessons: [LessonSpec, LessonSpec, LessonSpec, LessonSpec];
};

type CourseSpec = {
  slug: CourseSlug;
  title: string;
  description: string;
  iKey: InstructorKey;
  status: CourseStatus;
  enrollmentType: EnrollmentType;
  price?: string;
  level: CourseLevel;
  catSlug: CategorySlug;
  whatYouWillLearn: string[];
  tags: string[];
  hasAssignment: boolean;
  modTitles: [string, string, string];
  lessonTitles: [string[], string[], string[]];
};

// ── module/lesson builder ─────────────────────────────────────────────────────

function buildModules(sp: CourseSpec): [ModuleSpec, ModuleSpec, ModuleSpec] {
  const [mt0, mt1, mt2] = sp.modTitles;
  const [lt0, lt1, lt2] = sp.lessonTitles;

  return [
    {
      title: mt0,
      lessons: [
        { title: lt0[0], type: LessonType.TEXT, duration: 480, isPreview: true, readingTime: 8 },
        { title: lt0[1], type: LessonType.TEXT, duration: 420, readingTime: 7 },
        { title: lt0[2], type: LessonType.VIDEO, duration: 1200 },
        { title: lt0[3], type: LessonType.TEXT, duration: 360, readingTime: 6 },
      ],
    },
    {
      title: mt1,
      lessons: [
        { title: lt1[0], type: LessonType.TEXT, duration: 480, readingTime: 8 },
        { title: lt1[1], type: LessonType.VIDEO, duration: 1500 },
        { title: lt1[2], type: LessonType.TEXT, duration: 420, readingTime: 7 },
        sp.hasAssignment
          ? { title: lt1[3], type: LessonType.ASSIGNMENT, duration: 3600 }
          : { title: lt1[3], type: LessonType.TEXT, duration: 360, readingTime: 6 },
      ],
    },
    {
      title: mt2,
      lessons: [
        { title: lt2[0], type: LessonType.TEXT, duration: 420, readingTime: 7 },
        { title: lt2[1], type: LessonType.VIDEO, duration: 1800 },
        { title: lt2[2], type: LessonType.TEXT, duration: 360, readingTime: 6 },
        { title: lt2[3], type: LessonType.QUIZ, duration: 300 },
      ],
    },
  ];
}

// ── course specs ──────────────────────────────────────────────────────────────

const COURSE_SPECS: CourseSpec[] = [
  // c1 ─ TypeScript
  {
    slug: 'typescript-avanzado',
    title: 'TypeScript Avanzado: De Cero a Experto',
    description:
      'TypeScript es el superpoder del JavaScript moderno. En este curso dominarás el sistema de tipos, genéricos y decoradores con proyectos reales. Pasarás de JavaScript básico a código enterprise tipado y mantenible. Ideal para desarrolladores que quieren llevar su carrera al siguiente nivel.',
    iKey: 'i1',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.PAID,
    price: '29.99',
    level: CourseLevel.INTERMEDIATE,
    catSlug: 'desarrollo-web',
    whatYouWillLearn: [
      'Dominar el sistema de tipos de TypeScript',
      'Usar interfaces, genéricos y tipos avanzados',
      'Implementar decoradores y metadatos',
      'Integrar TypeScript con Node.js y React',
      'Aplicar patrones de diseño con TypeScript',
      'Configurar proyectos TypeScript en producción',
    ],
    tags: ['typescript', 'javascript', 'programación', 'backend', 'frontend'],
    hasAssignment: true,
    modTitles: [
      'Fundamentos de TypeScript',
      'Tipos Avanzados y Decoradores',
      'TypeScript en Producción',
    ],
    lessonTitles: [
      [
        'Introducción a TypeScript y su ecosistema',
        'Tipos primitivos y anotaciones de tipo',
        'Funciones tipadas y sobrecarga',
        'Interfaces y type aliases en profundidad',
      ],
      [
        'Genéricos y restricciones de tipo',
        'Tipos condicionales y mapped types',
        'Decoradores de clase y método',
        'Proyecto: API REST completamente tipada',
      ],
      [
        'Configuración avanzada del tsconfig.json',
        'TypeScript con Node.js y Express',
        'Patrones de diseño con TypeScript',
        'Evaluación final: TypeScript avanzado',
      ],
    ],
  },
  // c2 ─ Python
  {
    slug: 'python-data-science',
    title: 'Python para Data Science y Análisis',
    description:
      'Aprende Python desde cero con enfoque en ciencia de datos. Dominarás NumPy, Pandas, Matplotlib y Seaborn para manipular y visualizar datos reales. Con proyectos usando datasets reales generarás insights valiosos desde el primer módulo. El punto de partida perfecto para tu carrera en data science.',
    iKey: 'i2',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.FREE,
    level: CourseLevel.BEGINNER,
    catSlug: 'ciencia-de-datos',
    whatYouWillLearn: [
      'Dominar la sintaxis y estructuras de Python',
      'Manipular datos con NumPy y Pandas',
      'Limpiar y preparar datasets para análisis',
      'Crear visualizaciones con Matplotlib y Seaborn',
      'Realizar análisis exploratorio de datos (EDA)',
      'Exportar resultados y generar reportes',
    ],
    tags: ['python', 'data-science', 'pandas', 'numpy', 'análisis-de-datos'],
    hasAssignment: false,
    modTitles: ['Fundamentos de Python', 'NumPy y Pandas', 'Visualización y Análisis'],
    lessonTitles: [
      [
        'Introducción a Python y configuración del entorno',
        'Variables, tipos de datos y estructuras',
        'Control de flujo y funciones en Python',
        'Programación orientada a objetos en Python',
      ],
      [
        'Arrays y operaciones con NumPy',
        'DataFrames y Series con Pandas',
        'Limpieza y transformación de datos',
        'Agrupaciones y estadísticas con Pandas',
      ],
      [
        'Visualización con Matplotlib',
        'Gráficos avanzados con Seaborn',
        'Análisis exploratorio de datos completo',
        'Evaluación final: Python para Data Science',
      ],
    ],
  },
  // c3 ─ Figma
  {
    slug: 'diseno-ux-ui-figma',
    title: 'Diseño UX/UI Profesional con Figma',
    description:
      'Domina el diseño de interfaces profesionales con Figma, la herramienta líder en el mercado. Aprenderás a crear wireframes, prototipos interactivos y sistemas de diseño escalables. Desde los principios básicos de UX hasta la entrega de assets al equipo de desarrollo. Al finalizar tendrás un portafolio listo para mostrar a clientes y empleadores.',
    iKey: 'i3',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.PAID,
    price: '24.99',
    level: CourseLevel.BEGINNER,
    catSlug: 'diseno-ux-ui',
    whatYouWillLearn: [
      'Dominar la interfaz y herramientas de Figma',
      'Diseñar componentes reutilizables y variantes',
      'Crear sistemas de diseño escalables',
      'Prototipar flujos de usuario interactivos',
      'Aplicar principios de UX a tus diseños',
      'Entregar especificaciones al equipo de desarrollo',
    ],
    tags: ['figma', 'ux', 'ui', 'diseño', 'prototipado'],
    hasAssignment: false,
    modTitles: ['Fundamentos de Figma y UX', 'Diseño de Componentes', 'Prototipado y Entrega'],
    lessonTitles: [
      [
        'Introducción a Figma y principios de UX',
        'Navegación por la interfaz y herramientas básicas',
        'Formas, vectores y estilos visuales',
        'Texto y tipografía en interfaces digitales',
      ],
      [
        'Componentes y variantes en Figma',
        'Auto Layout y diseño responsivo',
        'Sistemas de diseño y design tokens',
        'Creación de un sistema de diseño completo',
      ],
      [
        'Conexiones de prototipo y flujos de usuario',
        'Animaciones y transiciones avanzadas',
        'Handoff y especificaciones para desarrollo',
        'Evaluación final: Diseño UX/UI con Figma',
      ],
    ],
  },
  // c4 ─ Machine Learning
  {
    slug: 'machine-learning-python',
    title: 'Machine Learning con Python Aplicado',
    description:
      'Implementa algoritmos de machine learning reales con Python, scikit-learn y TensorFlow. Desde los fundamentos estadísticos hasta modelos avanzados de clasificación y regresión. Trabajarás con datasets del mundo real y aprenderás a evaluar y optimizar tus modelos. El conocimiento adquirido te permitirá resolver problemas complejos con inteligencia artificial.',
    iKey: 'i2',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.CODE,
    price: '44.99',
    level: CourseLevel.INTERMEDIATE,
    catSlug: 'inteligencia-artificial',
    whatYouWillLearn: [
      'Implementar algoritmos supervisados y no supervisados',
      'Preparar y limpiar datos para ML',
      'Evaluar y optimizar modelos con métricas correctas',
      'Usar scikit-learn para algoritmos clásicos',
      'Construir redes neuronales básicas con TensorFlow',
      'Desplegar modelos en entornos de producción',
    ],
    tags: ['machine-learning', 'python', 'scikit-learn', 'tensorflow', 'inteligencia-artificial'],
    hasAssignment: true,
    modTitles: [
      'Fundamentos de Machine Learning',
      'Algoritmos Supervisados',
      'Modelos Avanzados y Producción',
    ],
    lessonTitles: [
      [
        '¿Qué es el Machine Learning? Fundamentos',
        'Tipos de aprendizaje automático',
        'Preparación y exploración de datos',
        'Métricas de evaluación de modelos',
      ],
      [
        'Regresión lineal y logística',
        'Árboles de decisión y Random Forest',
        'Máquinas de soporte vectorial (SVM)',
        'Proyecto: Clasificador de datos reales',
      ],
      [
        'Clustering y algoritmos no supervisados',
        'Reducción de dimensionalidad con PCA',
        'Optimización de hiperparámetros',
        'Evaluación final: Machine Learning con Python',
      ],
    ],
  },
  // c5 ─ React / Next.js
  {
    slug: 'react-nextjs-fullstack',
    title: 'React y Next.js Full Stack Moderno',
    description:
      'Construye aplicaciones web modernas y escalables con React y Next.js. Desde componentes básicos hasta el App Router con Server Components, aprenderás todas las características del framework líder. Implementarás autenticación, bases de datos y APIs, y desplegarás en producción con Vercel. Un curso completo para convertirte en desarrollador fullstack moderno.',
    iKey: 'i1',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.PAID,
    price: '34.99',
    level: CourseLevel.INTERMEDIATE,
    catSlug: 'desarrollo-web',
    whatYouWillLearn: [
      'Dominar React hooks y gestión de estado',
      'Usar el App Router y Server Components de Next.js',
      'Implementar autenticación con NextAuth.js',
      'Conectar bases de datos con Prisma y PostgreSQL',
      'Optimizar el rendimiento de aplicaciones Next.js',
      'Desplegar y escalar aplicaciones en Vercel',
    ],
    tags: ['react', 'nextjs', 'javascript', 'fullstack', 'frontend'],
    hasAssignment: true,
    modTitles: ['Fundamentos de React', 'Next.js App Router', 'Fullstack y Despliegue'],
    lessonTitles: [
      [
        'Introducción a React y JSX',
        'Componentes, props y gestión de estado',
        'Hooks esenciales: useState, useEffect y useContext',
        'Routing con React Router v6',
      ],
      [
        'Next.js App Router y Server Components',
        'Data fetching y caché en Next.js 14',
        'Autenticación con NextAuth.js v5',
        'Proyecto: Aplicación fullstack con Next.js',
      ],
      [
        'Bases de datos con Prisma y PostgreSQL',
        'Optimización de rendimiento en Next.js',
        'Testing en aplicaciones React con Vitest',
        'Evaluación final: React y Next.js Full Stack',
      ],
    ],
  },
  // c6 ─ SQL
  {
    slug: 'sql-postgresql-practico',
    title: 'SQL y PostgreSQL Práctico',
    description:
      'Aprende SQL desde los fundamentos y domina PostgreSQL, la base de datos relacional más popular del open source. Desde consultas básicas hasta técnicas avanzadas como CTEs, índices y optimización de queries. Trabajarás con datos reales y aprenderás a diseñar esquemas de base de datos eficientes. Indispensable para cualquier desarrollador backend o analista de datos.',
    iKey: 'i1',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.FREE,
    level: CourseLevel.BEGINNER,
    catSlug: 'ciencia-de-datos',
    whatYouWillLearn: [
      'Escribir consultas SELECT, INSERT, UPDATE y DELETE',
      'Usar JOINs para combinar tablas relacionadas',
      'Crear subconsultas y CTEs para consultas complejas',
      'Optimizar queries con índices y EXPLAIN',
      'Diseñar esquemas de base de datos normalizados',
      'Administrar usuarios y permisos en PostgreSQL',
    ],
    tags: ['sql', 'postgresql', 'bases-de-datos', 'backend', 'datos'],
    hasAssignment: false,
    modTitles: ['SQL Básico', 'SQL Avanzado', 'PostgreSQL y Optimización'],
    lessonTitles: [
      [
        'Introducción a bases de datos relacionales',
        'Consultas SELECT, FROM y WHERE',
        'JOINs: INNER, LEFT, RIGHT y FULL OUTER',
        'Funciones de agregado y GROUP BY',
      ],
      [
        'Subconsultas y CTEs con WITH',
        'Window functions avanzadas',
        'Transacciones y control de concurrencia',
        'Diseño de esquemas normalizados',
      ],
      [
        'Índices y optimización de queries',
        'Funciones y procedimientos almacenados',
        'Seguridad y gestión de usuarios en PostgreSQL',
        'Evaluación final: SQL y PostgreSQL',
      ],
    ],
  },
  // c7 ─ Docker / Kubernetes
  {
    slug: 'docker-kubernetes-devops',
    title: 'Docker, Kubernetes y DevOps Esencial',
    description:
      'Domina las herramientas esenciales de DevOps moderno: Docker, Kubernetes y CI/CD. Aprenderás a containerizar aplicaciones, orquestar servicios con Kubernetes y automatizar el despliegue con GitHub Actions. Este curso te prepara para trabajar en entornos de producción basados en microservicios. Conviértete en el enlace entre desarrollo y operaciones que toda empresa busca.',
    iKey: 'i1',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.ASSIGNED,
    level: CourseLevel.INTERMEDIATE,
    catSlug: 'desarrollo-web',
    whatYouWillLearn: [
      'Crear y gestionar contenedores Docker',
      'Orquestar servicios con Docker Compose',
      'Administrar clusters de Kubernetes',
      'Implementar pipelines de CI/CD',
      'Monitorear aplicaciones en producción',
      'Aplicar mejores prácticas de DevOps y GitOps',
    ],
    tags: ['docker', 'kubernetes', 'devops', 'cicd', 'contenedores'],
    hasAssignment: false,
    modTitles: ['Docker Esencial', 'Orquestación con Kubernetes', 'DevOps y CI/CD'],
    lessonTitles: [
      [
        '¿Qué es Docker? Arquitectura y conceptos clave',
        'Imágenes Docker y el Dockerfile',
        'Contenedores, volúmenes y redes en Docker',
        'Docker Compose para entornos multi-servicio',
      ],
      [
        'Introducción a Kubernetes y arquitectura de pods',
        'Deployments, Services y ConfigMaps',
        'Persistent Volumes y gestión de estado',
        'Estrategias de despliegue: Rolling y Blue-Green',
      ],
      [
        'Pipelines de CI/CD con GitHub Actions',
        'Monitoreo con Prometheus y Grafana',
        'Seguridad en contenedores y clusters',
        'Evaluación final: Docker y Kubernetes',
      ],
    ],
  },
  // c8 ─ Deep Learning
  {
    slug: 'deep-learning-redes-neuronales',
    title: 'Deep Learning y Redes Neuronales',
    description:
      'Sumérgete en el mundo del deep learning con PyTorch y TensorFlow. Explorarás arquitecturas avanzadas como CNNs, RNNs, LSTMs y Transformers. Aprenderás a hacer fine-tuning de modelos de lenguaje grandes y a desplegarlos en producción. Diseñado para científicos de datos que quieren especializarse en inteligencia artificial avanzada.',
    iKey: 'i2',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.PAID,
    price: '49.99',
    level: CourseLevel.ADVANCED,
    catSlug: 'inteligencia-artificial',
    whatYouWillLearn: [
      'Implementar redes neuronales con PyTorch',
      'Diseñar CNN para visión por computadora',
      'Usar LSTM y GRU para datos secuenciales',
      'Entender la arquitectura Transformer',
      'Hacer fine-tuning de modelos pre-entrenados',
      'Desplegar modelos de deep learning en producción',
    ],
    tags: ['deep-learning', 'pytorch', 'transformers', 'llm', 'inteligencia-artificial'],
    hasAssignment: true,
    modTitles: [
      'Fundamentos de Deep Learning',
      'Arquitecturas Especializadas',
      'Modelos en Producción',
    ],
    lessonTitles: [
      [
        'Introducción a redes neuronales artificiales',
        'PyTorch: tensores y autograd',
        'Entrenamiento y backpropagation',
        'Regularización y optimización avanzada',
      ],
      [
        'CNN para visión por computadora',
        'LSTM y GRU para datos secuenciales',
        'Arquitectura Transformer y mecanismo de atención',
        'Proyecto: Fine-tuning de modelo pre-entrenado',
      ],
      [
        'Transfer learning y modelos fundacionales',
        'Despliegue con TorchServe y ONNX',
        'Optimización y cuantización de modelos',
        'Evaluación final: Deep Learning y Redes Neuronales',
      ],
    ],
  },
  // c9 ─ Marketing
  {
    slug: 'marketing-digital-seo',
    title: 'Marketing Digital y SEO Avanzado',
    description:
      'Domina las estrategias de marketing digital y SEO que funcionan en 2026. Aprenderás a posicionar sitios web en Google, crear campañas de paid media y construir una presencia digital sólida. Desde Google Analytics hasta Google Ads y Meta Ads, cubriremos todas las herramientas del marketer moderno. Ideal para emprendedores y marketers que quieren crecer en el entorno digital.',
    iKey: 'i3',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.FREE,
    level: CourseLevel.BEGINNER,
    catSlug: 'marketing-digital',
    whatYouWillLearn: [
      'Optimizar sitios web para motores de búsqueda (SEO)',
      'Crear campañas de Google Ads y Meta Ads',
      'Analizar métricas con Google Analytics 4',
      'Diseñar estrategias de content marketing',
      'Gestionar redes sociales de forma profesional',
      'Medir ROI y optimizar presupuestos de marketing',
    ],
    tags: ['seo', 'marketing-digital', 'google-ads', 'content-marketing', 'analytics'],
    hasAssignment: false,
    modTitles: [
      'Fundamentos del Marketing Digital',
      'Estrategias de Tráfico Pagado y Orgánico',
      'Analytics y Optimización',
    ],
    lessonTitles: [
      [
        'Introducción al marketing digital en 2026',
        'Fundamentos de SEO on-page y off-page',
        'Creación de contenido que posiciona y convierte',
        'Redes sociales para negocios y personal branding',
      ],
      [
        'Google Ads: campañas de búsqueda y display',
        'Meta Ads: Facebook e Instagram Ads',
        'Email marketing y automatización de campañas',
        'Estrategia integral de marketing de contenidos',
      ],
      [
        'Google Analytics 4: configuración y análisis',
        'Conversión, CRO y A/B testing',
        'ROI, métricas clave y reportes ejecutivos',
        'Evaluación final: Marketing Digital y SEO',
      ],
    ],
  },
  // c10 ─ Ciberseguridad
  {
    slug: 'ciberseguridad-fundamentos',
    title: 'Fundamentos de Ciberseguridad',
    description:
      'Aprende los conceptos fundamentales de la ciberseguridad y cómo proteger sistemas, redes y datos. Desde las amenazas más comunes hasta técnicas de defensa avanzadas, tendrás una visión completa del panorama de seguridad informática. Estudiarás OWASP Top 10, criptografía, seguridad en redes y mejores prácticas en el desarrollo de software. Ideal para desarrolladores y profesionales IT.',
    iKey: 'i1',
    status: CourseStatus.PUBLISHED,
    enrollmentType: EnrollmentType.PAID,
    price: '39.99',
    level: CourseLevel.BEGINNER,
    catSlug: 'ciberseguridad',
    whatYouWillLearn: [
      'Identificar y mitigar las amenazas más comunes',
      'Aplicar los principios del OWASP Top 10',
      'Implementar criptografía y gestión de contraseñas',
      'Asegurar redes y configurar firewalls',
      'Realizar análisis de vulnerabilidades básico',
      'Desarrollar software siguiendo principios de seguridad',
    ],
    tags: ['ciberseguridad', 'seguridad', 'owasp', 'networking', 'desarrollo-seguro'],
    hasAssignment: false,
    modTitles: [
      'Fundamentos de Ciberseguridad',
      'Ataques y Vulnerabilidades Comunes',
      'Defensa y Mejores Prácticas',
    ],
    lessonTitles: [
      [
        'Introducción a la ciberseguridad y el panorama actual',
        'Criptografía: conceptos y aplicaciones prácticas',
        'Seguridad en redes y protocolo TLS/SSL',
        'Gestión de identidad, autenticación y autorización',
      ],
      [
        'OWASP Top 10: inyección SQL y XSS',
        'OWASP Top 10: autenticación rota y acceso no autorizado',
        'Análisis de vulnerabilidades con herramientas',
        'Ingeniería social, phishing y ataques de fuerza bruta',
      ],
      [
        'Desarrollo seguro de software (DevSecOps)',
        'Respuesta a incidentes y forense digital básico',
        'Cumplimiento normativo y auditoría de seguridad',
        'Evaluación final: Fundamentos de Ciberseguridad',
      ],
    ],
  },
  // c11 ─ Scrum (DRAFT)
  {
    slug: 'gestion-agil-scrum',
    title: 'Gestión Ágil de Proyectos con Scrum',
    description:
      'Aprende a gestionar proyectos de software con la metodología Scrum, el framework ágil más popular del mundo. Dominarás los roles, eventos y artefactos de Scrum y cómo aplicarlos en equipos reales. Este curso incluye simulaciones de sprints, retrospectivas y planificación de releases. Prepárate para la certificación Scrum Master con ejercicios prácticos y casos de estudio reales.',
    iKey: 'i3',
    status: CourseStatus.DRAFT,
    enrollmentType: EnrollmentType.PAID,
    price: '19.99',
    level: CourseLevel.BEGINNER,
    catSlug: 'gestion-de-proyectos',
    whatYouWillLearn: [
      'Entender los valores del manifiesto ágil',
      'Dominar los roles de Scrum: PO, SM y Dev Team',
      'Facilitar ceremonias Scrum efectivamente',
      'Gestionar el Product Backlog y las historias de usuario',
      'Estimar esfuerzo con Planning Poker y story points',
      'Prepararse para certificaciones Scrum internacionales',
    ],
    tags: ['scrum', 'agile', 'gestión-proyectos', 'metodología-ágil', 'product-owner'],
    hasAssignment: false,
    modTitles: [
      'Valores y Principios Ágiles',
      'Framework Scrum en Práctica',
      'Escalado y Certificación',
    ],
    lessonTitles: [
      [
        'El manifiesto ágil y sus doce principios',
        'Metodologías ágiles: Scrum, Kanban y SAFe',
        'Roles en Scrum: Product Owner, Scrum Master y Dev Team',
        'El Product Backlog y las historias de usuario',
      ],
      [
        'Sprint Planning: estimación y planificación',
        'Daily Scrum y el tablero Kanban',
        'Sprint Review y demostración al cliente',
        'Retrospectiva y mejora continua del equipo',
      ],
      [
        'Escalado ágil con SAFe y LeSS',
        'Métricas ágiles: velocidad y burndown chart',
        'Gestión de stakeholders y comunicación efectiva',
        'Evaluación final: Gestión Ágil con Scrum',
      ],
    ],
  },
  // c12 ─ iOS / Swift (DRAFT)
  {
    slug: 'ios-swift-desarrollo',
    title: 'Desarrollo iOS con Swift',
    description:
      'Desarrolla aplicaciones nativas para iOS con Swift y Xcode. Aprenderás desde los fundamentos del lenguaje Swift hasta la creación de aplicaciones completas con SwiftUI. Cubrirás persistencia de datos, consumo de APIs REST, animaciones y publicación en la App Store. Diseñado para desarrolladores que quieren crear experiencias nativas de alta calidad en el ecosistema Apple.',
    iKey: 'i1',
    status: CourseStatus.DRAFT,
    enrollmentType: EnrollmentType.PAID,
    price: '44.99',
    level: CourseLevel.INTERMEDIATE,
    catSlug: 'desarrollo-mobile',
    whatYouWillLearn: [
      'Dominar la sintaxis y características modernas de Swift',
      'Crear interfaces con SwiftUI y UIKit',
      'Gestionar datos con Core Data y SwiftData',
      'Consumir APIs REST con URLSession y Combine',
      'Implementar notificaciones push y mapas',
      'Publicar aplicaciones en la App Store',
    ],
    tags: ['swift', 'ios', 'swiftui', 'desarrollo-mobile', 'apple'],
    hasAssignment: false,
    modTitles: ['Swift y Fundamentos iOS', 'SwiftUI y UIKit', 'Datos, APIs y App Store'],
    lessonTitles: [
      [
        'Introducción a Swift y el ecosistema Apple',
        'Variables, opcionales y manejo de errores en Swift',
        'Programación orientada a objetos en Swift',
        'Protocolos, extensiones y generics en Swift',
      ],
      [
        'Fundamentos de SwiftUI: views y modifiers',
        'Navegación, listas y formularios en SwiftUI',
        'UIKit: UIViewController y UITableView',
        'Integración de SwiftUI con UIKit',
      ],
      [
        'Persistencia de datos con Core Data y SwiftData',
        'Consumo de APIs REST con URLSession y Combine',
        'Notificaciones push, mapas y permisos',
        'Evaluación final: Desarrollo iOS con Swift',
      ],
    ],
  },
];

// ── exported functions ────────────────────────────────────────────────────────

export async function seedCourses(
  prisma: PrismaClient,
  users: UsersMap,
  cats: Record<CategorySlug, string>,
): Promise<CoursesMap> {
  const courses = {} as CoursesMap;

  for (const sp of COURSE_SPECS) {
    const course = await prisma.course.create({
      data: {
        slug: sp.slug,
        title: sp.title,
        description: sp.description,
        instructorId: users.instructorIdMap[sp.iKey],
        status: sp.status,
        enrollmentType: sp.enrollmentType,
        ...(sp.price !== undefined ? { price: sp.price } : {}),
        level: sp.level,
        categoryId: cats[sp.catSlug],
        whatYouWillLearn: sp.whatYouWillLearn,
        tags: sp.tags,
        createdBy: users.ldquiroz.id,
      },
    });

    await prisma.courseSettings.create({
      data: {
        courseId: course.id,
        certificateEnabled: sp.status === CourseStatus.PUBLISHED,
        forumEnabled: true,
        ratingEnabled: true,
        hasModules: true,
        createdBy: users.ldquiroz.id,
      },
    });

    courses[sp.slug] = course.id;
  }

  console.log('✅ Courses + CourseSettings (12)');
  return courses;
}

export async function seedModulesAndLessons(
  prisma: PrismaClient,
  users: UsersMap,
  courses: CoursesMap,
): Promise<ModulesAndLessonsMap> {
  const courseLessons: Record<string, string[]> = {};
  const quizLessons: Record<string, string> = {};
  const assignmentLessons: Record<string, string> = {};

  for (const sp of COURSE_SPECS) {
    const courseId = courses[sp.slug];
    const lessonIds: string[] = [];
    const mods = buildModules(sp);

    for (let mi = 0; mi < mods.length; mi++) {
      const mod = mods[mi];

      const module = await prisma.courseModule.create({
        data: {
          courseId,
          title: mod.title,
          order: mi + 1,
          isPublished: true,
          createdBy: users.ldquiroz.id,
        },
      });

      for (let li = 0; li < mod.lessons.length; li++) {
        const les = mod.lessons[li];

        const content =
          les.type === LessonType.TEXT
            ? tc(les.title)
            : les.type === LessonType.VIDEO
              ? vc(les.title)
              : les.type === LessonType.ASSIGNMENT
                ? ac(les.title)
                : QUIZ_CONTENT;

        const lesson = await prisma.lesson.create({
          data: {
            moduleId: module.id,
            title: les.title,
            order: li + 1,
            type: les.type,
            duration: les.duration,
            isPreview: les.isPreview ?? false,
            isPublished: true,
            content,
            ...(les.readingTime !== undefined ? { readingTime: les.readingTime } : {}),
            createdBy: users.ldquiroz.id,
          },
        });

        lessonIds.push(lesson.id);

        if (les.type === LessonType.QUIZ) quizLessons[courseId] = lesson.id;
        if (les.type === LessonType.ASSIGNMENT) assignmentLessons[courseId] = lesson.id;
      }
    }

    courseLessons[courseId] = lessonIds;
  }

  console.log('✅ Modules and Lessons (36 modules, 144 lessons)');
  return { courseLessons, quizLessons, assignmentLessons };
}
