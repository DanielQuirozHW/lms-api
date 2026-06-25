import type { PrismaClient } from '@prisma/client';
import { UserRole, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface UsersMap {
  system: User;
  ldquiroz: User;
  admin: User;
  i1: User;
  i2: User;
  i3: User;
  s1: User;
  s2: User;
  s3: User;
  s4: User;
  s5: User;
  s6: User;
  s7: User;
  s8: User;
  s9: User;
  s10: User;
  /** All 15 users in creation order: system, ldquiroz, admin, i1-i3, s1-s10 */
  all: User[];
  /** s1-s10 in order */
  students: User[];
  /** { i1: id, i2: id, i3: id } */
  instructorIdMap: Record<string, string>;
}

export async function seedUsers(prisma: PrismaClient): Promise<UsersMap> {
  const PW = await bcrypt.hash('Password123!', 10);

  const system = await prisma.user.create({
    data: {
      email: 'system@nexuslms.internal',
      passwordHash: PW,
      firstName: 'Sistema',
      lastName: 'NexusLMS',
      roles: [UserRole.STUDENT],
      isVerified: true,
    },
  });

  const ldquiroz = await prisma.user.create({
    data: {
      email: 'ldquiroz@hwapplications.com',
      passwordHash: PW,
      firstName: 'Luis',
      lastName: 'Quiroz',
      roles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      isVerified: true,
      bio: 'Administrador principal de NexusLMS y desarrollador full-stack con experiencia en arquitecturas cloud y sistemas de aprendizaje en línea.',
      location: 'Ciudad de México',
      phone: '+52 55 1234 5678',
      birthDate: new Date('1988-03-15'),
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@nexuslms.com',
      passwordHash: PW,
      firstName: 'Carlos',
      lastName: 'Mendoza',
      roles: [UserRole.ADMIN],
      isVerified: true,
      location: 'Ciudad de México',
      phone: '+52 55 9876 5432',
      birthDate: new Date('1985-07-22'),
    },
  });

  const i1 = await prisma.user.create({
    data: {
      email: 'instructor1@nexuslms.com',
      passwordHash: PW,
      firstName: 'Ana',
      lastName: 'García',
      roles: [UserRole.INSTRUCTOR],
      isVerified: true,
      bio: 'Desarrolladora web full-stack con 8 años de experiencia en TypeScript, Node.js y React. Apasionada por la enseñanza y el desarrollo de software moderno.',
      location: 'Madrid',
      phone: '+34 91 234 5678',
      birthDate: new Date('1990-04-10'),
    },
  });

  const i2 = await prisma.user.create({
    data: {
      email: 'instructor2@nexuslms.com',
      passwordHash: PW,
      firstName: 'Roberto',
      lastName: 'Martínez',
      roles: [UserRole.INSTRUCTOR],
      isVerified: true,
      bio: 'Data scientist y experto en ML/IA con doctorado en ciencias computacionales. Ha trabajado en proyectos de IA para empresas Fortune 500.',
      location: 'Buenos Aires',
      phone: '+54 11 5678 9012',
      birthDate: new Date('1985-11-28'),
    },
  });

  const i3 = await prisma.user.create({
    data: {
      email: 'instructor3@nexuslms.com',
      passwordHash: PW,
      firstName: 'Sofía',
      lastName: 'López',
      roles: [UserRole.INSTRUCTOR],
      isVerified: true,
      bio: 'Diseñadora UX/UI y especialista en marketing digital con más de 6 años de experiencia en agencias creativas internacionales.',
      location: 'Bogotá',
      phone: '+57 1 234 5678',
      birthDate: new Date('1992-08-05'),
    },
  });

  const studentDefs = [
    { n: 1, fn: 'Miguel', ln: 'Torres', loc: 'Ciudad de México', bd: '1998-02-14' },
    { n: 2, fn: 'Laura', ln: 'Ramírez', loc: 'Guadalajara', bd: '2000-06-22' },
    { n: 3, fn: 'Diego', ln: 'Hernández', loc: 'Monterrey', bd: '1999-09-07' },
    { n: 4, fn: 'Valentina', ln: 'Cruz', loc: 'Bogotá', bd: '2001-01-30' },
    { n: 5, fn: 'Andrés', ln: 'Morales', loc: 'Madrid', bd: '1997-11-18' },
    { n: 6, fn: 'Isabella', ln: 'Vargas', loc: 'Buenos Aires', bd: '2002-04-25' },
    { n: 7, fn: 'Sebastián', ln: 'Ríos', loc: 'Lima', bd: '1999-07-12' },
    { n: 8, fn: 'Camila', ln: 'Jiménez', loc: 'Santiago', bd: '2000-03-08' },
    { n: 9, fn: 'Pablo', ln: 'Fernández', loc: 'Ciudad de México', bd: '1998-12-20' },
    { n: 10, fn: 'María', ln: 'Sánchez', loc: 'Medellín', bd: '2001-08-15' },
  ] as const;

  const students = await Promise.all(
    studentDefs.map((d) =>
      prisma.user.create({
        data: {
          email: `student${String(d.n)}@nexuslms.com`,
          passwordHash: PW,
          firstName: d.fn,
          lastName: d.ln,
          roles: [UserRole.STUDENT],
          isVerified: true,
          location: d.loc,
          birthDate: new Date(d.bd),
        },
      }),
    ),
  );

  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = students;

  console.log('✅ Users (15)');

  return {
    system,
    ldquiroz,
    admin,
    i1,
    i2,
    i3,
    s1,
    s2,
    s3,
    s4,
    s5,
    s6,
    s7,
    s8,
    s9,
    s10,
    all: [system, ldquiroz, admin, i1, i2, i3, ...students],
    students,
    instructorIdMap: { i1: i1.id, i2: i2.id, i3: i3.id },
  };
}

// ── category slugs exported as a const so other seed files can reference
// them without magic strings
export const CATEGORY_SLUGS = [
  'desarrollo-web',
  'ciencia-de-datos',
  'diseno-ux-ui',
  'marketing-digital',
  'ciberseguridad',
  'inteligencia-artificial',
  'gestion-de-proyectos',
  'desarrollo-mobile',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export async function seedCategories(
  prisma: PrismaClient,
  users: UsersMap,
): Promise<Record<CategorySlug, string>> {
  const catDefs: { name: string; slug: CategorySlug }[] = [
    { name: 'Desarrollo Web', slug: 'desarrollo-web' },
    { name: 'Ciencia de Datos', slug: 'ciencia-de-datos' },
    { name: 'Diseño UX/UI', slug: 'diseno-ux-ui' },
    { name: 'Marketing Digital', slug: 'marketing-digital' },
    { name: 'Ciberseguridad', slug: 'ciberseguridad' },
    { name: 'Inteligencia Artificial', slug: 'inteligencia-artificial' },
    { name: 'Gestión de Proyectos', slug: 'gestion-de-proyectos' },
    { name: 'Desarrollo Mobile', slug: 'desarrollo-mobile' },
  ];

  const cats = {} as Record<CategorySlug, string>;

  for (const c of catDefs) {
    const cat = await prisma.category.create({
      data: { name: c.name, slug: c.slug, createdBy: users.ldquiroz.id },
    });
    cats[c.slug] = cat.id;
  }

  console.log('✅ Categories (8)');

  return cats;
}
