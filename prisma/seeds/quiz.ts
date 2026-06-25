import type { PrismaClient } from '@prisma/client';
import { QuestionType } from '@prisma/client';
import type { UsersMap } from './users';
import { COURSE_SLUGS, type CourseSlug } from './courses';

// ── private spec types ────────────────────────────────────────────────────────

type QOption = { text: string; isCorrect: boolean };
type QDef = { text: string; type: QuestionType; options: QOption[] };

const SC = QuestionType.SINGLE_CHOICE;
const TF = QuestionType.TRUE_FALSE;

// ── quiz question data ────────────────────────────────────────────────────────

const QUIZ_DATA: Record<CourseSlug, QDef[]> = {
  // c1 ─ TypeScript
  'typescript-avanzado': [
    {
      text: '¿Qué es un tipo genérico en TypeScript?',
      type: SC,
      options: [
        {
          text: 'Un tipo que acepta parámetros para ser reutilizable con múltiples tipos',
          isCorrect: true,
        },
        { text: 'Un tipo que solo acepta valores de tipo string', isCorrect: false },
        { text: 'Un tipo que no puede ser null ni undefined', isCorrect: false },
        { text: 'Un tipo definido en el archivo tsconfig.json', isCorrect: false },
      ],
    },
    {
      text: '¿Cuál es la diferencia principal entre `type` e `interface` en TypeScript?',
      type: SC,
      options: [
        {
          text: '`interface` es extensible mediante declaración múltiple; `type` no lo es',
          isCorrect: true,
        },
        { text: '`type` solo se usa para tipos primitivos', isCorrect: false },
        { text: '`interface` no puede tener métodos opcionales', isCorrect: false },
        { text: 'Ambos son exactamente equivalentes en todos los casos', isCorrect: false },
      ],
    },
    {
      text: 'Los decoradores de TypeScript son una forma de metaprogramación que puede modificar el comportamiento de clases y métodos.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'El tipo `never` en TypeScript representa un valor que puede ser undefined o null.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c2 ─ Python Data Science
  'python-data-science': [
    {
      text: '¿Qué función de NumPy se utiliza para crear un array con valores aleatorios entre 0 y 1?',
      type: SC,
      options: [
        { text: 'np.random.rand()', isCorrect: true },
        { text: 'np.array.create()', isCorrect: false },
        { text: 'np.zeros()', isCorrect: false },
        { text: 'np.linspace()', isCorrect: false },
      ],
    },
    {
      text: '¿Qué operación realiza df.groupby("col").agg("sum") en Pandas?',
      type: SC,
      options: [
        {
          text: 'Agrupa los datos por la columna "col" y suma los valores de cada grupo',
          isCorrect: true,
        },
        { text: 'Crea una columna nueva con la suma total del DataFrame', isCorrect: false },
        { text: 'Ordena el DataFrame de forma ascendente por la columna "col"', isCorrect: false },
        { text: 'Filtra las filas donde "col" es mayor a cero', isCorrect: false },
      ],
    },
    {
      text: 'En Pandas, la función merge() combina DataFrames de forma similar a un JOIN en SQL.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'Matplotlib solo puede crear gráficos de barras y de líneas.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c3 ─ Figma / UX
  'diseno-ux-ui-figma': [
    {
      text: '¿Qué característica de Figma permite crear elementos que comparten una base común y se actualizan de forma global?',
      type: SC,
      options: [
        { text: 'Componentes maestros', isCorrect: true },
        { text: 'Frames anidados', isCorrect: false },
        { text: 'Grupos de capas', isCorrect: false },
        { text: 'Páginas independientes', isCorrect: false },
      ],
    },
    {
      text: '¿Qué principio de usabilidad de Nielsen establece que el sistema debe hablar el lenguaje del usuario?',
      type: SC,
      options: [
        { text: 'Concordancia entre el sistema y el mundo real', isCorrect: true },
        { text: 'Consistencia y estándares', isCorrect: false },
        { text: 'Visibilidad del estado del sistema', isCorrect: false },
        { text: 'Prevención de errores', isCorrect: false },
      ],
    },
    {
      text: 'Un wireframe de baja fidelidad incluye colores definitivos, tipografía real y contenido final del producto.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
    {
      text: 'En Figma, los prototipos interactivos permiten simular la navegación de la aplicación sin escribir código.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],

  // c4 ─ Machine Learning
  'machine-learning-python': [
    {
      text: '¿Qué técnica se usa para evaluar la capacidad de generalización de un modelo en datos no vistos durante el entrenamiento?',
      type: SC,
      options: [
        { text: 'Validación cruzada (cross-validation)', isCorrect: true },
        { text: 'Aumentar el tamaño del set de entrenamiento', isCorrect: false },
        { text: 'Incrementar el número de épocas', isCorrect: false },
        { text: 'Aplicar normalización min-max a los datos', isCorrect: false },
      ],
    },
    {
      text: '¿Cuál es la consecuencia principal del overfitting en un modelo de machine learning?',
      type: SC,
      options: [
        {
          text: 'Alta precisión en entrenamiento pero baja precisión en datos nuevos',
          isCorrect: true,
        },
        {
          text: 'El modelo es demasiado simple para capturar los patrones del dataset',
          isCorrect: false,
        },
        { text: 'El modelo no converge durante el entrenamiento', isCorrect: false },
        { text: 'El tiempo de inferencia aumenta significativamente', isCorrect: false },
      ],
    },
    {
      text: 'La regresión logística, a pesar de su nombre, es un algoritmo de clasificación.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'Un modelo con sesgo alto (high bias) está sobreajustado a los datos de entrenamiento.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c5 ─ React / Next.js
  'react-nextjs-fullstack': [
    {
      text: '¿Cuál hook de React se usa para ejecutar efectos secundarios cuando un componente se monta o sus dependencias cambian?',
      type: SC,
      options: [
        { text: 'useEffect', isCorrect: true },
        { text: 'useState', isCorrect: false },
        { text: 'useCallback', isCorrect: false },
        { text: 'useRef', isCorrect: false },
      ],
    },
    {
      text: '¿Qué ventaja principal ofrece el Server Side Rendering (SSR) en Next.js?',
      type: SC,
      options: [
        {
          text: 'Mejora el SEO y el tiempo de primera carga visible para el usuario',
          isCorrect: true,
        },
        { text: 'Elimina por completo la necesidad de JavaScript en el cliente', isCorrect: false },
        { text: 'Permite almacenar datos en cookies de forma automática', isCorrect: false },
        { text: 'Reemplaza el funcionamiento de useState en los componentes', isCorrect: false },
      ],
    },
    {
      text: 'En el App Router de Next.js, todos los componentes son Client Components por defecto.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
    {
      text: 'El hook useMemo en React se utiliza para memorizar funciones y evitar su recreación innecesaria entre renders.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c6 ─ SQL
  'sql-postgresql-practico': [
    {
      text: '¿Qué tipo de JOIN devuelve todas las filas de la tabla izquierda aunque no exista coincidencia en la tabla derecha?',
      type: SC,
      options: [
        { text: 'LEFT JOIN', isCorrect: true },
        { text: 'INNER JOIN', isCorrect: false },
        { text: 'RIGHT JOIN', isCorrect: false },
        { text: 'FULL OUTER JOIN', isCorrect: false },
      ],
    },
    {
      text: '¿Qué propiedad ACID garantiza que los cambios de una transacción persisten incluso ante un fallo del sistema?',
      type: SC,
      options: [
        { text: 'Durabilidad', isCorrect: true },
        { text: 'Atomicidad', isCorrect: false },
        { text: 'Consistencia', isCorrect: false },
        { text: 'Aislamiento', isCorrect: false },
      ],
    },
    {
      text: 'La cláusula HAVING filtra filas individuales antes de que se aplique la agrupación GROUP BY.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
    {
      text: 'Un índice en una base de datos puede mejorar el rendimiento de SELECT pero puede ralentizar INSERT y UPDATE.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],

  // c7 ─ Docker / Kubernetes
  'docker-kubernetes-devops': [
    {
      text: '¿Cuál es la diferencia entre una imagen Docker y un contenedor Docker?',
      type: SC,
      options: [
        {
          text: 'La imagen es una plantilla inmutable; el contenedor es una instancia en ejecución',
          isCorrect: true,
        },
        { text: 'Un contenedor es más ligero que una imagen en disco', isCorrect: false },
        {
          text: 'La imagen se usa en producción y el contenedor solo en desarrollo',
          isCorrect: false,
        },
        { text: 'Ambos son conceptos equivalentes con diferente nombre', isCorrect: false },
      ],
    },
    {
      text: '¿Qué objeto de Kubernetes mantiene el número deseado de réplicas de pods en ejecución?',
      type: SC,
      options: [
        { text: 'Deployment', isCorrect: true },
        { text: 'Service', isCorrect: false },
        { text: 'ConfigMap', isCorrect: false },
        { text: 'Namespace', isCorrect: false },
      ],
    },
    {
      text: 'Docker comparte el kernel del sistema operativo host, lo que lo hace más ligero que una máquina virtual tradicional.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'En Continuous Deployment, cada cambio aprobado en el pipeline se despliega automáticamente a producción sin intervención manual.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],

  // c8 ─ Deep Learning
  'deep-learning-redes-neuronales': [
    {
      text: '¿Cuál es la función principal del mecanismo de atención (attention) en la arquitectura Transformer?',
      type: SC,
      options: [
        {
          text: 'Ponderar la importancia de cada token en relación con los demás de la secuencia',
          isCorrect: true,
        },
        { text: 'Reducir el número de parámetros totales de la red neuronal', isCorrect: false },
        { text: 'Acelerar el entrenamiento mediante la paralelización de capas', isCorrect: false },
        { text: 'Reemplazar la función de activación ReLU en capas ocultas', isCorrect: false },
      ],
    },
    {
      text: '¿Qué tipo de capa en una CNN reduce las dimensiones espaciales de los mapas de características?',
      type: SC,
      options: [
        { text: 'Capa de pooling', isCorrect: true },
        { text: 'Capa convolucional', isCorrect: false },
        { text: 'Capa totalmente conectada (fully-connected)', isCorrect: false },
        { text: 'Capa de normalización por lote (batch norm)', isCorrect: false },
      ],
    },
    {
      text: 'El backpropagation utiliza la regla de la cadena del cálculo diferencial para actualizar los pesos de la red.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'La función de activación sigmoide es la mejor opción para capas ocultas profundas por su rango acotado entre 0 y 1.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c9 ─ Marketing / SEO
  'marketing-digital-seo': [
    {
      text: '¿Qué métrica SEO indica la autoridad de un dominio basándose en la calidad y cantidad de sus backlinks?',
      type: SC,
      options: [
        { text: 'Domain Authority (DA)', isCorrect: true },
        { text: 'Click Through Rate (CTR)', isCorrect: false },
        { text: 'Bounce Rate', isCorrect: false },
        { text: 'Pages per Session', isCorrect: false },
      ],
    },
    {
      text: '¿Qué tipo de keyword suele tener menor volumen de búsqueda pero mayor intención de compra o conversión?',
      type: SC,
      options: [
        { text: 'Long-tail keywords', isCorrect: true },
        { text: 'Short-tail keywords', isCorrect: false },
        { text: 'Brand keywords', isCorrect: false },
        { text: 'Navigational keywords', isCorrect: false },
      ],
    },
    {
      text: 'En Google Analytics 4, el modelo de medición basado en eventos reemplaza al modelo basado en sesiones de Universal Analytics.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'Los backlinks de sitios con alta autoridad tienen mayor impacto positivo en el posicionamiento SEO que los de sitios con baja autoridad.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],

  // c10 ─ Ciberseguridad
  'ciberseguridad-fundamentos': [
    {
      text: '¿Cuál es la diferencia principal entre el cifrado simétrico y el asimétrico?',
      type: SC,
      options: [
        {
          text: 'El simétrico usa la misma clave para cifrar y descifrar; el asimétrico usa un par clave pública/privada',
          isCorrect: true,
        },
        { text: 'El cifrado simétrico es siempre más seguro que el asimétrico', isCorrect: false },
        {
          text: 'El cifrado asimétrico solo puede utilizarse para cifrar correos electrónicos',
          isCorrect: false,
        },
        {
          text: 'El cifrado simétrico no se puede usar en comunicaciones web seguras',
          isCorrect: false,
        },
      ],
    },
    {
      text: '¿Qué tipo de ataque ocurre cuando un atacante intercepta la comunicación entre dos partes sin que ninguna lo detecte?',
      type: SC,
      options: [
        { text: 'Man-in-the-Middle (MitM)', isCorrect: true },
        { text: 'SQL Injection', isCorrect: false },
        { text: 'Cross-Site Scripting (XSS)', isCorrect: false },
        { text: 'Denial of Service (DoS)', isCorrect: false },
      ],
    },
    {
      text: 'HTTPS garantiza que los datos transmitidos entre el navegador y el servidor no pueden ser leídos por terceros en tránsito.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'Una contraseña almacenada con hash MD5 es suficientemente segura para proteger cuentas de usuario en producción.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
  ],

  // c11 ─ Scrum
  'gestion-agil-scrum': [
    {
      text: '¿Cuál es el artefacto de Scrum que contiene la lista priorizada de todo el trabajo pendiente del producto?',
      type: SC,
      options: [
        { text: 'Product Backlog', isCorrect: true },
        { text: 'Sprint Backlog', isCorrect: false },
        { text: 'Incremento', isCorrect: false },
        { text: 'Definition of Done', isCorrect: false },
      ],
    },
    {
      text: '¿Qué ceremonia de Scrum tiene como objetivo revisar el incremento del Sprint e incorporar feedback de los stakeholders?',
      type: SC,
      options: [
        { text: 'Sprint Review', isCorrect: true },
        { text: 'Sprint Planning', isCorrect: false },
        { text: 'Daily Scrum', isCorrect: false },
        { text: 'Sprint Retrospective', isCorrect: false },
      ],
    },
    {
      text: 'En Scrum, el Scrum Master tiene autoridad para tomar decisiones sobre las funcionalidades que se incluyen en el producto.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: false },
        { text: 'Falso', isCorrect: true },
      ],
    },
    {
      text: 'La velocidad del equipo (velocity) en Scrum se mide en story points completados por Sprint.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],

  // c12 ─ iOS / Swift
  'ios-swift-desarrollo': [
    {
      text: '¿Cuál es la forma segura de desenvolver un Optional en Swift para evitar un crash en tiempo de ejecución?',
      type: SC,
      options: [
        { text: 'Usando optional binding con if let o guard let', isCorrect: true },
        { text: 'Usando el operador ! siempre que se necesite el valor', isCorrect: false },
        { text: 'Declarando todas las variables como var en lugar de let', isCorrect: false },
        { text: 'Usando el modificador @State en SwiftUI', isCorrect: false },
      ],
    },
    {
      text: '¿Qué modificador de SwiftUI permite ejecutar código cuando una vista aparece en pantalla?',
      type: SC,
      options: [
        { text: '.onAppear', isCorrect: true },
        { text: '.onLoad', isCorrect: false },
        { text: '.onMount', isCorrect: false },
        { text: '.viewDidLoad', isCorrect: false },
      ],
    },
    {
      text: 'En Swift, una closure puede capturar y almacenar referencias a variables y constantes del contexto donde fue creada.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
    {
      text: 'En SwiftUI, las vistas se actualizan automáticamente cuando cambia el valor de una propiedad marcada con @State.',
      type: TF,
      options: [
        { text: 'Verdadero', isCorrect: true },
        { text: 'Falso', isCorrect: false },
      ],
    },
  ],
};

// ── exported function ─────────────────────────────────────────────────────────

export async function seedQuiz(
  prisma: PrismaClient,
  users: UsersMap,
  _courseLessons: Record<string, string[]>,
  quizLessons: Record<string, string>,
  assignmentLessons: Partial<Record<string, string>>,
): Promise<void> {
  // quizLessons was built by iterating COURSE_SPECS in order, so its entries
  // are in the same order as COURSE_SLUGS — use positional mapping.
  const quizEntries = Object.entries(quizLessons);

  for (let i = 0; i < COURSE_SLUGS.length; i++) {
    const slug = COURSE_SLUGS[i];
    const [courseId, quizLessonId] = quizEntries[i];

    // QuizSettings
    await prisma.quizSettings.create({
      data: {
        lessonId: quizLessonId,
        passingScore: 70,
        maxAttempts: 3,
        shuffleQuestions: true,
        blocksProgress: false,
        createdBy: users.ldquiroz.id,
      },
    });

    // Questions + Options
    const questions = QUIZ_DATA[slug];
    for (let qi = 0; qi < questions.length; qi++) {
      const qd = questions[qi];
      const question = await prisma.question.create({
        data: {
          lessonId: quizLessonId,
          text: qd.text,
          type: qd.type,
          order: qi + 1,
          points: 1,
          createdBy: users.ldquiroz.id,
        },
      });

      for (let oi = 0; oi < qd.options.length; oi++) {
        await prisma.questionOption.create({
          data: {
            questionId: question.id,
            text: qd.options[oi].text,
            isCorrect: qd.options[oi].isCorrect,
            order: oi + 1,
            createdBy: users.ldquiroz.id,
          },
        });
      }
    }

    // AssignmentSettings (only for c1, c4, c5, c8)
    const assignLessonId = assignmentLessons[courseId];
    if (assignLessonId !== undefined) {
      await prisma.assignmentSettings.create({
        data: {
          lessonId: assignLessonId,
          maxScore: 100,
          passingScore: 60,
          allowLateSubmission: true,
          maxAttempts: 2,
          createdBy: users.ldquiroz.id,
        },
      });
    }
  }

  console.log('✅ Quiz settings + questions (12 quizzes, 48 questions, 160 options)');
  console.log('✅ Assignment settings (4 courses)');
}
