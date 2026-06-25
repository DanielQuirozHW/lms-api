import type { PrismaClient } from '@prisma/client';
import {
  NotificationType,
  CalendarEventType,
  GlobalAnnouncementType,
  type ForumPost,
} from '@prisma/client';
import type { UsersMap } from './users';
import type { CoursesMap, CourseSlug } from './courses';
import type { EnrollmentsMap } from './enrollments';

// ── private types ─────────────────────────────────────────────────────────────

type StudentKey = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 's10';
type InstructorKey = 'i1' | 'i2' | 'i3';
type AnyUserKey = StudentKey | InstructorKey | 'ldquiroz';

// ── ratings ───────────────────────────────────────────────────────────────────

type RatingSpec = { sKey: StudentKey; slug: CourseSlug; score: number; review: string };

const RATINGS: RatingSpec[] = [
  {
    sKey: 's1',
    slug: 'react-nextjs-fullstack',
    score: 4.5,
    review:
      'Excelente curso de React y Next.js. El App Router quedó muy claro y los proyectos prácticos son muy útiles.',
  },
  {
    sKey: 's2',
    slug: 'python-data-science',
    score: 4.0,
    review: 'Buen curso de Python. Pandas y NumPy explicados con ejemplos muy claros.',
  },
  {
    sKey: 's3',
    slug: 'diseno-ux-ui-figma',
    score: 5.0,
    review:
      'El mejor curso de Figma que tomé. Sofía explica cada concepto con claridad y los ejercicios son muy prácticos.',
  },
  {
    sKey: 's4',
    slug: 'machine-learning-python',
    score: 4.2,
    review: 'Muy completo. Los algoritmos de ML están bien explicados con ejemplos reales.',
  },
  {
    sKey: 's5',
    slug: 'typescript-avanzado',
    score: 4.8,
    review:
      'Imprescindible para cualquier desarrollador TypeScript. Genéricos y decoradores quedaron muy claros.',
  },
  {
    sKey: 's6',
    slug: 'deep-learning-redes-neuronales',
    score: 3.8,
    review: 'El contenido de deep learning es bueno pero algunos videos son un poco largos.',
  },
  {
    sKey: 's7',
    slug: 'sql-postgresql-practico',
    score: 4.5,
    review: 'SQL explicado de manera muy práctica. Los ejercicios con PostgreSQL son excelentes.',
  },
  {
    sKey: 's8',
    slug: 'docker-kubernetes-devops',
    score: 4.2,
    review:
      'Docker y Kubernetes muy bien explicados. El proyecto final fue desafiante pero instructivo.',
  },
  {
    sKey: 's9',
    slug: 'marketing-digital-seo',
    score: 4.7,
    review: 'Excelente curso de marketing digital. Las estrategias de SEO son muy aplicables.',
  },
  {
    sKey: 's10',
    slug: 'python-data-science',
    score: 4.9,
    review: 'El mejor curso de Python que tomé. Roberto explica con ejemplos muy claros.',
  },
];

// ── notifications ─────────────────────────────────────────────────────────────

const NOTIF_SPECS: { type: NotificationType; title: string; body: string; isRead: boolean }[] = [
  {
    type: NotificationType.ENROLLMENT,
    title: '¡Inscripción confirmada!',
    body: 'Tu inscripción ha sido procesada con éxito. Comienza cuando quieras y aprende a tu propio ritmo.',
    isRead: true,
  },
  {
    type: NotificationType.NEW_LESSON,
    title: 'Nueva lección disponible',
    body: 'Se publicó una nueva lección en tu curso. Accede ahora para seguir avanzando en tu aprendizaje.',
    isRead: true,
  },
  {
    type: NotificationType.QUIZ_PASSED,
    title: '¡Aprobaste la evaluación!',
    body: 'Obtuviste una excelente calificación en el quiz del módulo. ¡Continúa con el mismo entusiasmo!',
    isRead: true,
  },
  {
    type: NotificationType.ASSIGNMENT_GRADED,
    title: 'Tu entrega fue calificada',
    body: 'El instructor revisó tu proyecto y te asignó una calificación. Revisa los comentarios de retroalimentación en el curso.',
    isRead: false,
  },
  {
    type: NotificationType.COURSE_COMPLETED,
    title: '¡Felicitaciones, curso completado!',
    body: 'Has completado el curso satisfactoriamente. Tu certificado de finalización ya está disponible para descargar.',
    isRead: false,
  },
  {
    type: NotificationType.ANNOUNCEMENT,
    title: 'Nuevo anuncio del instructor',
    body: 'El instructor publicó un mensaje importante en el curso. Revísalo en la sección de anuncios para no perderte ninguna novedad.',
    isRead: false,
  },
];

// ── announcements (1 per published course) ────────────────────────────────────

type AnnouncementSpec = { slug: CourseSlug; iKey: InstructorKey; title: string; body: string };

const ANNOUNCEMENTS: AnnouncementSpec[] = [
  {
    slug: 'typescript-avanzado',
    iKey: 'i1',
    title: 'Bienvenidos a TypeScript Avanzado: De Cero a Experto',
    body: 'Estoy muy emocionada de tenerte en este curso. A lo largo del programa dominarás el sistema de tipos, los genéricos y los decoradores de TypeScript con proyectos reales. El foro está abierto para cualquier duda — juntos resolveremos cada obstáculo que encuentres.',
  },
  {
    slug: 'python-data-science',
    iKey: 'i2',
    title: 'Bienvenidos a Python para Data Science y Análisis',
    body: 'Es un placer tenerte en este viaje por la ciencia de datos con Python. Aprenderemos desde los fundamentos del lenguaje hasta el análisis de datos con NumPy, Pandas y Matplotlib. Aprovecha cada ejercicio práctico y comparte tus notebooks en el foro para recibir retroalimentación.',
  },
  {
    slug: 'diseno-ux-ui-figma',
    iKey: 'i3',
    title: 'Bienvenidos a Diseño UX/UI Profesional con Figma',
    body: '¡Bienvenidos a este curso donde transformaremos ideas en interfaces hermosas y funcionales! Juntos crearemos componentes reutilizables, sistemas de diseño escalables y prototipos interactivos para tu portafolio. Comparte tus avances en el foro — la retroalimentación de los compañeros es invaluable.',
  },
  {
    slug: 'machine-learning-python',
    iKey: 'i2',
    title: 'Bienvenidos a Machine Learning con Python Aplicado',
    body: 'El machine learning es uno de los campos más fascinantes y demandados de la actualidad. Implementaremos algoritmos reales con scikit-learn y TensorFlow usando datasets del mundo real. La práctica constante es la clave — comiencen con los ejercicios del módulo 1 desde hoy mismo.',
  },
  {
    slug: 'react-nextjs-fullstack',
    iKey: 'i1',
    title: 'Bienvenidos a React y Next.js Full Stack Moderno',
    body: 'Me alegra mucho tenerte en este curso donde construiremos aplicaciones web modernas de punta a punta. Dominaremos el App Router, Server Components, autenticación y bases de datos con Prisma, y al final tendrás una aplicación real desplegada en Vercel. ¡El foro es el lugar perfecto para compartir tu progreso!',
  },
  {
    slug: 'sql-postgresql-practico',
    iKey: 'i1',
    title: 'Bienvenidos a SQL y PostgreSQL Práctico',
    body: 'Saber SQL es una de las habilidades más valiosas para cualquier desarrollador o analista de datos. Iremos de las consultas básicas hasta técnicas avanzadas de optimización, todo con ejercicios sobre datos reales. Comparte tus queries en el foro — siempre hay mucho que aprender de los enfoques de los compañeros.',
  },
  {
    slug: 'docker-kubernetes-devops',
    iKey: 'i1',
    title: 'Bienvenidos a Docker, Kubernetes y DevOps Esencial',
    body: 'Las habilidades DevOps son cada vez más demandadas en el mercado, y este curso te dará las bases para containerizar, orquestar y desplegar aplicaciones profesionalmente. Trabajaremos con herramientas reales: Docker, Kubernetes y GitHub Actions en pipelines que podrás reutilizar en tus proyectos. ¡Cualquier duda técnica, nos vemos en el foro!',
  },
  {
    slug: 'deep-learning-redes-neuronales',
    iKey: 'i2',
    title: 'Bienvenidos a Deep Learning y Redes Neuronales',
    body: 'Este es uno de los cursos más exigentes y gratificantes que he preparado. Exploraremos PyTorch, CNNs, LSTMs y Transformers hasta llegar al fine-tuning de modelos fundacionales. La clave es practicar con los notebooks desde el día uno — el deep learning se aprende programando, no solo leyendo.',
  },
  {
    slug: 'marketing-digital-seo',
    iKey: 'i3',
    title: 'Bienvenidos a Marketing Digital y SEO Avanzado',
    body: '¡Bienvenidos a este curso donde aprenderemos las estrategias de marketing digital que realmente funcionan en 2026! Desde SEO on-page hasta campañas de Google Ads y análisis con GA4, cubriremos todo lo que necesitas para crecer en el entorno digital. Les animo a aplicar cada técnica en sus propios proyectos mientras avanzan.',
  },
  {
    slug: 'ciberseguridad-fundamentos',
    iKey: 'i1',
    title: 'Bienvenidos a Fundamentos de Ciberseguridad',
    body: 'La seguridad informática es una responsabilidad de todos los que desarrollamos software. En este curso aprenderán a identificar vulnerabilidades, aplicar el OWASP Top 10 y desarrollar software de forma segura desde el primer día. El foro está disponible para discutir casos de estudio que quieran analizar juntos.',
  },
];

// ── forum threads ─────────────────────────────────────────────────────────────

type PostSpec = { authorKey: AnyUserKey; content: string };

type ThreadSpec = {
  courseSlug: CourseSlug;
  instructorKey: InstructorKey;
  title: string;
  posts: readonly [PostSpec, PostSpec, PostSpec, PostSpec];
};

const FORUM_THREADS: ThreadSpec[] = [
  // ── c1: TypeScript ──────────────────────────────────────────────────────────
  {
    courseSlug: 'typescript-avanzado',
    instructorKey: 'i1',
    title: '¿Cuándo usar `interface` vs `type` en TypeScript?',
    posts: [
      {
        authorKey: 'i1',
        content:
          'Una de las preguntas más frecuentes en TypeScript. La regla práctica: usa `interface` para describir la forma de objetos cuando necesitas extensibilidad y declaration merging. Usa `type` para uniones, intersecciones y alias complejos. ¿Alguien tiene un caso concreto que les haya generado confusión?',
      },
      {
        authorKey: 's1',
        content:
          'Yo opté por `interface` para los modelos de datos de mi API y `type` para los estados de la UI. El error del compilador cuando intenté extender un tipo unión con `extends` me dejó muy en claro la diferencia.',
      },
      {
        authorKey: 's5',
        content:
          '¿Entonces para una propiedad que puede ser `string | null` siempre tengo que usar `type`? Intenté declararla con `interface` y el compilador no lo aceptó.',
      },
      {
        authorKey: 'i1',
        content:
          '¡Exacto, Andrés! Para tipos unión como `string | null` o literales como `"light" | "dark"` siempre usamos `type` — `interface` solo puede describir la forma de un objeto. Con esa regla tienes el 95% de los casos cubiertos. Revisa la lección 4 del módulo 1 para los casos más avanzados.',
      },
    ],
  },
  {
    courseSlug: 'typescript-avanzado',
    instructorKey: 'i1',
    title: 'Error TS2322 al pasar argumentos a una función tipada',
    posts: [
      {
        authorKey: 's5',
        content:
          'Me sale TS2322: Argument of type X is not assignable to parameter of type Y. El tipo parece correcto visualmente, no entiendo por qué TypeScript lo rechaza.',
      },
      {
        authorKey: 'i1',
        content:
          'TS2322 indica incompatibilidad de tipos. Los casos más comunes: pasas `null` donde no se espera (con strictNullChecks activo), pasas un objeto literal con propiedades extra (excess property check), o hay un mismatch entre `readonly` y mutable. Comparte el fragmento de código y lo depuramos juntos.',
      },
      {
        authorKey: 's1',
        content:
          'A mí me pasó con objetos literales: TypeScript aplica el excess property check en literales que no aplica en variables tipadas. La solución fue asignar el objeto a una variable del tipo esperado antes de pasarlo como argumento.',
      },
      {
        authorKey: 'i1',
        content:
          'Miguel tiene razón — el excess property check es una de las características más útiles pero que puede confundir al principio. Si el objeto tiene propiedades extra, asígnalo a una variable del tipo esperado primero. Profundizamos en esto en el ejercicio del módulo 2.',
      },
    ],
  },
  // ── c2: Python ──────────────────────────────────────────────────────────────
  {
    courseSlug: 'python-data-science',
    instructorKey: 'i2',
    title: '¿Cuál es la diferencia entre `loc` e `iloc` en Pandas?',
    posts: [
      {
        authorKey: 'i2',
        content:
          '`loc` selecciona datos por etiqueta de índice; `iloc` por posición entera (0-based). Si tu DataFrame tiene un índice de texto o de fechas, la diferencia es crítica. Con un RangeIndex que empieza en 0 parecen equivalentes, pero divergen en cuanto hay un reset_index o valores faltantes.',
      },
      {
        authorKey: 's10',
        content:
          'Me quemé con esto trabajando con un CSV que tenía fechas como índice. Usé `iloc[0]` esperando la primera fecha y me devolvió la posición 0. Ahora siempre verifico el tipo de índice antes de seleccionar.',
      },
      {
        authorKey: 's2',
        content:
          '¿Si hago `df.reset_index()` el comportamiento de `loc` cambia? Estoy confundida sobre cuándo usar cada uno después del reset.',
      },
      {
        authorKey: 'i2',
        content:
          'Buena pregunta, Laura. Después de `reset_index()` el índice pasa a ser un RangeIndex 0, 1, 2... y `loc` e `iloc` vuelven a coincidir para selección por posición. La regla mnemotécnica: `loc` = Label (etiqueta), `iloc` = Integer (posición). Con esa regla nunca más los confundirás.',
      },
    ],
  },
  {
    courseSlug: 'python-data-science',
    instructorKey: 'i2',
    title: '¿Cómo manejar valores NaN sin perder demasiados datos?',
    posts: [
      {
        authorKey: 's2',
        content:
          'Tengo un dataset con un 20% de NaN distribuidos en varias columnas. Si uso `dropna()` pierdo demasiadas filas. ¿Cuál es la estrategia de imputación recomendada para este porcentaje?',
      },
      {
        authorKey: 'i2',
        content:
          'Para un 20% de NaN, `dropna()` no es la opción correcta. Para numéricas, imputa con la mediana: `df["col"].fillna(df["col"].median())` — más robusta que la media ante outliers. Para categóricas, usa la moda. Si vas a usar los datos en ML, considera `SimpleImputer` de scikit-learn dentro de un Pipeline para evitar data leakage.',
      },
      {
        authorKey: 's10',
        content:
          '¿Y si los NaN tienen un patrón, como que siempre faltan los datos de ciertos días? ¿La imputación simple no introduce sesgo en ese caso?',
      },
      {
        authorKey: 'i2',
        content:
          '¡Excelente observación, María! Cuando los NaN son MNAR (Missing Not At Random), la imputación simple sí puede introducir sesgo. En ese caso, crea una columna binaria `col_was_nan` para preservar esa información e imputa el valor numérico con la estrategia habitual. Así el modelo puede aprender del patrón de ausencia. Lo cubrimos en el módulo 3.',
      },
    ],
  },
  // ── c3: Figma ───────────────────────────────────────────────────────────────
  {
    courseSlug: 'diseno-ux-ui-figma',
    instructorKey: 'i3',
    title: '¿Cómo organizar componentes maestros en proyectos grandes de Figma?',
    posts: [
      {
        authorKey: 'i3',
        content:
          'En proyectos grandes, la organización es tan importante como el propio diseño. Mi estructura recomendada: usa Atomic Design con páginas separadas para átomos, moléculas y organismos. Nombra con la convención Categoría/Nombre/Variante — por ejemplo "Button/Primary/Default". Figma los agrupa automáticamente en el panel de Assets.',
      },
      {
        authorKey: 's3',
        content:
          'Empecé a aplicar esta estructura en mi portafolio y la diferencia es notable. Antes tardaba minutos en encontrar un componente; ahora segundos. El naming con barras es el cambio más impactante.',
      },
      {
        authorKey: 's5',
        content:
          '¿Y cómo manejarías los iconos? ¿Los incluyes dentro de los átomos o tienen su propio sistema separado?',
      },
      {
        authorKey: 'i3',
        content:
          'Los iconos merecen su propia página "Icons" con nomenclatura consistente: Icono/Categoría/Nombre (ej: "Icon/Navigation/Home"). Así puedes hacer icon swapping fácilmente en los componentes que los contienen — Figma lo soporta nativamente cuando los nombres son consistentes. Lo vemos en detalle en el módulo 2.',
      },
    ],
  },
  {
    courseSlug: 'diseno-ux-ui-figma',
    instructorKey: 'i3',
    title: 'Confusión entre Auto Layout y Constraints — ¿cuándo usar cada uno?',
    posts: [
      {
        authorKey: 's5',
        content:
          'Cuando aplico Auto Layout a un frame que ya usa Constraints, el comportamiento cambia de formas que no espero. ¿Cómo conviven estas dos características y cuándo priorizar una sobre la otra?',
      },
      {
        authorKey: 'i3',
        content:
          'Son herramientas para niveles distintos. Auto Layout controla cómo el frame se adapta a su contenido interno (padding, gap, dirección). Constraints controlan cómo un elemento responde al resize de su contenedor padre. Cuando un frame tiene Auto Layout, las constraints de sus hijos directos no aplican — Auto Layout toma el control.',
      },
      {
        authorKey: 's3',
        content:
          '¿O sea que si quiero que un botón se estire al ancho completo dentro de un Auto Layout, debo configurar "Fill container" en el hijo y no usar Constraints?',
      },
      {
        authorKey: 'i3',
        content:
          '¡Exactamente, Diego! En Auto Layout usa "Fill container" para que el hijo ocupe todo el espacio disponible. Es un cambio conceptual: de posicionamiento fijo a diseño fluido. Practica esto en el ejercicio de Auto Layout del módulo 2 — es el cambio más importante del curso.',
      },
    ],
  },
  // ── c5: React / Next.js ─────────────────────────────────────────────────────
  {
    courseSlug: 'react-nextjs-fullstack',
    instructorKey: 'i1',
    title: '¿Cuándo agregar "use client" en el App Router de Next.js?',
    posts: [
      {
        authorKey: 'i1',
        content:
          'Regla de oro: todo es Server Component por defecto. Solo agrega "use client" cuando necesites interactividad (onClick, onChange), hooks de estado o ciclo de vida (useState, useEffect), o APIs del navegador (localStorage, window). Mantén la mayor parte del árbol en el servidor para mejor performance y SEO.',
      },
      {
        authorKey: 's1',
        content:
          'Yo metí "use client" en casi todos los componentes al migrar desde Pages Router. Cuando Ana me explicó el modelo de Server Components, reescribí la mitad de la app y mejoró significativamente el tiempo de carga inicial.',
      },
      {
        authorKey: 's7',
        content:
          '¿Si un Server Component necesita pasar datos a un Client Component hijo, puede hacer el fetch en el servidor y pasarlos como props?',
      },
      {
        authorKey: 'i1',
        content:
          '¡Exactamente! Ese es el patrón correcto: el Server Component hace el fetch (o la query a la DB) y pasa los datos como props serializables al Client Component. Lo que NO puedes hacer es importar un Server Component dentro de un Client Component — la jerarquía es siempre servidor → cliente.',
      },
    ],
  },
  {
    courseSlug: 'react-nextjs-fullstack',
    instructorKey: 'i1',
    title: 'Hydration mismatch en Next.js — causas y soluciones',
    posts: [
      {
        authorKey: 's7',
        content:
          'Me sale "Hydration failed because the initial UI does not match" pero solo en producción. El componente usa `Date.toLocaleDateString()` para mostrar fechas. ¿Cómo lo soluciono?',
      },
      {
        authorKey: 'i1',
        content:
          'El hydration mismatch de fechas es el más clásico: el servidor renderiza con su zona horaria (UTC) y el cliente con la del usuario. Solución: mueve el formateo de fechas a un Client Component con useEffect, o usa `suppressHydrationWarning` en el elemento si la diferencia es intencional y no afecta la funcionalidad.',
      },
      {
        authorKey: 's1',
        content:
          'A mí me pasó lo mismo. Lo resolví creando un componente `<ClientDate>` que recibe el timestamp ISO y formatea solo en el cliente con useEffect. Así el servidor renderiza el valor sin formato y el cliente lo formatea localmente.',
      },
      {
        authorKey: 'i1',
        content:
          'Perfecto enfoque, Miguel. Para todo lo que depende del entorno del cliente (zona horaria, localStorage, window.innerWidth), un Client Component con useEffect es la solución idiomática. Como regla: si el valor puede diferir entre servidor y cliente, renderízalo solo en el cliente. Cubrimos más patrones en el módulo 3.',
      },
    ],
  },
  // ── c6: SQL ─────────────────────────────────────────────────────────────────
  {
    courseSlug: 'sql-postgresql-practico',
    instructorKey: 'i1',
    title: '¿Cómo leer el plan de ejecución con EXPLAIN ANALYZE?',
    posts: [
      {
        authorKey: 'i1',
        content:
          'EXPLAIN ANALYZE es la herramienta más valiosa para optimizar queries en PostgreSQL. El plan se lee de adentro hacia afuera: los nodos más indentados se ejecutan primero. Busca "Seq Scan" como señal de que falta un índice. "Index Scan" e "Index Only Scan" son lo que queremos ver. El costo está en unidades relativas, no absolutas.',
      },
      {
        authorKey: 's7',
        content:
          'Corrí EXPLAIN ANALYZE en la query del ejercicio 3 y vi "Seq Scan on orders (cost=0.00..4523.00 rows=150000)". Eso significa que está leyendo toda la tabla de 150k filas, ¿correcto?',
      },
      {
        authorKey: 's4',
        content:
          '¿Y qué índice debería crear para esa query? Filtra por `status = "pending"` y ordena por `created_at DESC`.',
      },
      {
        authorKey: 'i1',
        content:
          'Correcto, Sebastián — el Seq Scan confirma el full scan. Para ese caso, Valentina, el índice compuesto `CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC)` debería convertir ese Seq Scan en un Index Scan. Corre EXPLAIN ANALYZE antes y después para comparar el costo y verificar la mejora.',
      },
    ],
  },
  {
    courseSlug: 'sql-postgresql-practico',
    instructorKey: 'i1',
    title: 'CTEs vs subconsultas — ¿cuándo usar cada una?',
    posts: [
      {
        authorKey: 's4',
        content:
          '¿Cuándo es mejor usar una CTE con WITH en lugar de una subconsulta normal? Veo ambas usadas de forma similar en los ejemplos del curso.',
      },
      {
        authorKey: 'i1',
        content:
          'Funcionalmente hacen lo mismo en la mayoría de los casos. Usa CTE cuando: (1) la subconsulta se repite más de una vez en la query, (2) quieres nombrar pasos intermedios para mayor legibilidad, o (3) necesitas recursión (solo posible con CTEs). PostgreSQL 12+ optimiza ambas de forma similar; la elección es principalmente de estilo.',
      },
      {
        authorKey: 's7',
        content:
          '¿Los CTEs recursivos tienen casos de uso reales fuera de los ejemplos académicos de Fibonacci?',
      },
      {
        authorKey: 'i1',
        content:
          '¡Muy buena pregunta! Los CTEs recursivos son imprescindibles para datos jerárquicos: árboles de categorías de e-commerce, organigramas de empleados, rutas en grafos de relaciones. Ejemplo concreto: obtener todos los sub-módulos de un curso con cualquier nivel de anidamiento. Lo implementamos en el ejercicio final del módulo 2.',
      },
    ],
  },
  // ── c8: Deep Learning ───────────────────────────────────────────────────────
  {
    courseSlug: 'deep-learning-redes-neuronales',
    instructorKey: 'i2',
    title: '¿CNN o Transformer para clasificación de texto en 2026?',
    posts: [
      {
        authorKey: 'i2',
        content:
          'La respuesta en 2026 es casi siempre Transformer: usa un modelo pre-entrenado (DistilBERT, RoBERTa) con fine-tuning para tareas de NLP. CNN para texto solo tiene sentido cuando los recursos son muy limitados o la latencia de inferencia es crítica. Los Transformers han democratizado el NLP hasta el punto de que el fine-tuning es más rápido que entrenar una CNN from scratch.',
      },
      {
        authorKey: 's6',
        content:
          'Estoy clasificando reseñas de productos en español. ¿DistilBERT sería suficiente o necesito BERT completo para un accuracy razonable en este idioma?',
      },
      {
        authorKey: 's8',
        content:
          '¿Y qué diferencia hay en requisitos de GPU entre BERT y DistilBERT? Trabajo con solo 8GB de VRAM.',
      },
      {
        authorKey: 'i2',
        content:
          'DistilBERT es la elección correcta, Isabella — es 40% más pequeño y 60% más rápido que BERT con solo 3% menos de performance en clasificación. Para español, busca "distilbert-base-multilingual-cased". Con 8GB de VRAM tienes espacio, Camila — usa batch_size=16. El Trainer de HuggingFace lo simplifica en unas pocas líneas.',
      },
    ],
  },
  {
    courseSlug: 'deep-learning-redes-neuronales',
    instructorKey: 'i2',
    title: '¿Qué learning rate usar para fine-tuning de modelos pre-entrenados?',
    posts: [
      {
        authorKey: 's8',
        content:
          'Estoy haciendo fine-tuning de un Transformer pre-entrenado y el entrenamiento no converge bien. Probé con lr=0.001 como en redes from scratch y los pesos colapsan en las primeras épocas.',
      },
      {
        authorKey: 'i2',
        content:
          'Para fine-tuning de Transformers necesitas learning rates mucho más pequeños: entre 1e-5 y 5e-5 es el rango estándar. Con lr=0.001 destruyes los pesos pre-entrenados desde el inicio — el modelo "desaprende" todo lo aprendido. Empieza con lr=2e-5 y añade un scheduler de warmup + linear decay.',
      },
      {
        authorKey: 's6',
        content:
          '¿Los schedulers de warmup son obligatorios o son solo una optimización opcional? ¿Qué pasa en la práctica si no los uso?',
      },
      {
        authorKey: 'i2',
        content:
          'No son obligatorios pero sí muy recomendados. Sin warmup, las primeras actualizaciones pueden desestabilizar el modelo aunque el lr sea pequeño. Con warmup, el lr sube gradualmente en los primeros 10% de pasos, dando tiempo al optimizador de orientarse. El `get_linear_schedule_with_warmup` de HuggingFace lo implementa en una línea.',
      },
    ],
  },
];

// ── calendar events ───────────────────────────────────────────────────────────

type CalEventSpec = { type: CalendarEventType; title: string; description: string };

const CAL_EVENT_SPECS: CalEventSpec[] = [
  {
    type: CalendarEventType.ASSIGNMENT_DUE,
    title: 'Entrega del proyecto final del módulo',
    description:
      'Recuerda subir tu proyecto antes de la fecha límite para recibir retroalimentación a tiempo.',
  },
  {
    type: CalendarEventType.QUIZ_DUE,
    title: 'Evaluación del módulo en curso',
    description:
      'Prepárate repasando los ejercicios del módulo. Necesitas al menos 70 puntos para aprobar.',
  },
  {
    type: CalendarEventType.COURSE_START,
    title: 'Inicio del siguiente módulo',
    description:
      'El nuevo módulo está disponible hoy. Revisa el temario para saber qué esperar del contenido.',
  },
  {
    type: CalendarEventType.CUSTOM,
    title: 'Sesión de repaso con el instructor',
    description:
      'Sesión en vivo para resolver dudas y repasar los conceptos más importantes del módulo.',
  },
];

const BASE_CAL_DAYS = [5, 12, 19, 26] as const;

// ── lesson notes and bookmarks ────────────────────────────────────────────────

const NOTE_CONTENTS = [
  'Concepto clave: revisar la documentación oficial antes del proyecto. Los ejemplos del video son muy clarificadores — practicarlos en el sandbox.',
  'Punto importante para la evaluación: entender bien la diferencia entre estos dos enfoques. Crear tarjetas de memoria para consolidar antes del quiz.',
  'Para el proyecto final: este patrón es de uso obligatorio. Tiene impacto directo en la arquitectura de la solución — volver a revisar antes de entregar.',
] as const;

// Completed-course lessonIds per student (notes use 0-2, bookmarks use 3-5)
const STUDENT_PRIMARY: { sKey: StudentKey; slug: CourseSlug }[] = [
  { sKey: 's1', slug: 'react-nextjs-fullstack' },
  { sKey: 's2', slug: 'python-data-science' },
  { sKey: 's3', slug: 'diseno-ux-ui-figma' },
  { sKey: 's4', slug: 'machine-learning-python' },
  { sKey: 's5', slug: 'typescript-avanzado' },
  { sKey: 's6', slug: 'deep-learning-redes-neuronales' },
  { sKey: 's7', slug: 'sql-postgresql-practico' },
  { sKey: 's8', slug: 'docker-kubernetes-devops' },
  { sKey: 's9', slug: 'marketing-digital-seo' },
  { sKey: 's10', slug: 'python-data-science' },
];

// ── login event fixtures ──────────────────────────────────────────────────────

const IPS = [
  '187.45.123.67',
  '201.189.45.123',
  '190.45.67.89',
  '186.123.45.67',
  '200.91.23.45',
] as const;

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1',
] as const;

// ── exported function ─────────────────────────────────────────────────────────

export async function seedSocial(
  prisma: PrismaClient,
  users: UsersMap,
  courses: CoursesMap,
  _enrollments: EnrollmentsMap,
  courseLessons: Record<string, string[]>,
): Promise<void> {
  // ── course ratings ──────────────────────────────────────────────────────────

  for (const r of RATINGS) {
    await prisma.courseRating.create({
      data: {
        userId: users[r.sKey].id,
        courseId: courses[r.slug],
        score: r.score,
        review: r.review,
        createdBy: users[r.sKey].id,
      },
    });
  }
  console.log('✅ CourseRatings (10)');

  // ── notifications (6 per student, 60 total) ─────────────────────────────────

  for (const student of users.students) {
    for (const n of NOTIF_SPECS) {
      await prisma.notification.create({
        data: {
          userId: student.id,
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdBy: student.id,
        },
      });
    }
  }
  console.log('✅ Notifications (60)');

  // ── announcements (1 per published course) ──────────────────────────────────

  for (const spec of ANNOUNCEMENTS) {
    await prisma.announcement.create({
      data: {
        courseId: courses[spec.slug],
        instructorId: users[spec.iKey].id,
        title: spec.title,
        body: spec.body,
        createdBy: users[spec.iKey].id,
      },
    });
  }
  console.log('✅ Announcements (10)');

  // ── forum threads & posts ───────────────────────────────────────────────────

  for (const td of FORUM_THREADS) {
    const instructorId = users[td.instructorKey].id;

    const thread = await prisma.forumThread.create({
      data: {
        courseId: courses[td.courseSlug],
        authorId: instructorId,
        title: td.title,
        createdBy: instructorId,
      },
    });

    let firstPostId = '';
    for (let pi = 0; pi < td.posts.length; pi++) {
      const p = td.posts[pi];
      const authorId = users[p.authorKey].id;
      const created: ForumPost = await prisma.forumPost.create({
        data: {
          threadId: thread.id,
          authorId,
          content: p.content,
          parentId: pi === 0 ? null : firstPostId,
          createdBy: authorId,
        },
      });
      if (pi === 0) firstPostId = created.id;
    }
  }
  console.log('✅ ForumThreads (12) + ForumPosts (48)');

  // ── calendar events (4 per student = 40 total) ─────────────────────────────

  for (let si = 0; si < users.students.length; si++) {
    const student = users.students[si];
    for (let ei = 0; ei < CAL_EVENT_SPECS.length; ei++) {
      const spec = CAL_EVENT_SPECS[ei];
      const day = Math.min(BASE_CAL_DAYS[ei] + si, 30);
      const startDate = new Date(`2026-07-${String(day).padStart(2, '0')}T09:00:00Z`);
      await prisma.calendarEvent.create({
        data: {
          userId: student.id,
          title: spec.title,
          description: spec.description,
          type: spec.type,
          startDate,
          allDay: true,
          createdBy: student.id,
        },
      });
    }
  }
  console.log('✅ CalendarEvents (40)');

  // ── lesson notes (3 per student = 30 total) ────────────────────────────────

  for (const { sKey, slug } of STUDENT_PRIMARY) {
    const userId = users[sKey].id;
    const lessonIds = courseLessons[courses[slug]];
    if (lessonIds.length < 3) continue;

    for (let ni = 0; ni < NOTE_CONTENTS.length; ni++) {
      await prisma.lessonNote.create({
        data: { userId, lessonId: lessonIds[ni], content: NOTE_CONTENTS[ni], createdBy: userId },
      });
    }
  }
  console.log('✅ LessonNotes (30)');

  // ── lesson bookmarks (3 per student = 30 total, lessons 3-5 ≠ notes 0-2) ───

  for (const { sKey, slug } of STUDENT_PRIMARY) {
    const userId = users[sKey].id;
    const lessonIds = courseLessons[courses[slug]];
    if (lessonIds.length < 6) continue;

    for (let bi = 3; bi < 6; bi++) {
      await prisma.lessonBookmark.create({
        data: { userId, lessonId: lessonIds[bi], createdBy: userId },
      });
    }
  }
  console.log('✅ LessonBookmarks (30)');

  // ── notification preferences (all 15 users) ─────────────────────────────────

  for (const user of users.all) {
    await prisma.notificationPreferences.create({
      data: { userId: user.id, createdBy: user.id },
    });
  }
  console.log('✅ NotificationPreferences (15)');

  // ── login events (3 per user = 45 total) ───────────────────────────────────

  for (let ui = 0; ui < users.all.length; ui++) {
    const user = users.all[ui];
    for (let li = 0; li < 3; li++) {
      await prisma.loginEvent.create({
        data: {
          userId: user.id,
          ipAddress: IPS[(ui + li) % IPS.length],
          userAgent: UAS[li],
          createdBy: user.id,
        },
      });
    }
  }
  console.log('✅ LoginEvents (45)');

  // ── global announcement ─────────────────────────────────────────────────────

  await prisma.globalAnnouncement.create({
    data: {
      title: '¡Bienvenidos a NexusLMS!',
      message:
        'Estamos muy emocionados de presentar NexusLMS, tu plataforma de aprendizaje en línea en español. Explora nuestra biblioteca de cursos impartidos por expertos, participa en los foros de la comunidad y obtén certificados que potencien tu carrera profesional. ¡El conocimiento es la mejor inversión que puedes hacer!',
      type: GlobalAnnouncementType.INFO,
      isActive: true,
      createdBy: users.ldquiroz.id,
    },
  });
  console.log('✅ GlobalAnnouncement (1)');
}
