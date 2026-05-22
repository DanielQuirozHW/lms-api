# Prisma Patterns

Reference this skill when writing repository methods, schema changes, migrations, or any direct Prisma client usage.

---

## Always scope child queries to parent

A child resource (lesson, module) must always be queried with its parent constraint. Never look up by `id` alone when the resource is nested.

```typescript
// ✅ Correct — lesson verified against moduleId AND courseId
findFirst({ where: { id: lessonId, moduleId, module: { courseId } } })

// ✅ Correct — module verified against courseId
findFirst({ where: { id: moduleId, courseId } })

// ❌ Wrong — anyone with a valid lessonId from any course can access it
findUnique({ where: { id: lessonId } })
```

---

## findUnique vs findFirst

- Use `findUnique` when the field has a `@unique` constraint or `@@unique` — Prisma enforces uniqueness at the type level.
- Use `findFirst` when filtering by non-unique fields (e.g., `{ id, moduleId }` — id is unique but you're adding a parent scope filter).
- Never use `findFirst` as a substitute for `findUnique` on truly unique lookups; it reads differently and prevents Prisma from using unique index hints.

---

## Transactions for multi-step writes

Any operation that writes to multiple tables or must be atomic must use `$transaction`:

```typescript
// ✅ Correct — both writes succeed or both fail
const [enrollment, _] = await this.prisma.$transaction([
  this.prisma.enrollment.create({ data: enrollmentData }),
  this.prisma.course.update({ where: { id: courseId }, data: { enrollmentCount: { increment: 1 } } }),
]);

// Paginated list — standard pattern
const [data, total] = await this.prisma.$transaction([
  this.prisma.course.findMany({ where, skip, take, orderBy }),
  this.prisma.course.count({ where }),
]);
```

---

## Cascading deletes — always check onDelete behavior

Before adding a relation, verify the cascade behavior. Prisma defaults to `Restrict` (prevents delete if children exist). Common intentional cascade patterns:

```prisma
// Lessons deleted when module deleted
lessons Lesson[] @relation("ModuleLessons", onDelete: Cascade)

// Enrollments restricted from deleting active courses
enrollments Enrollment[] @relation("CourseEnrollments")  // default Restrict
```

**Before adding a cascading delete:** consider whether orphan data could cause issues. Document intent in a migration comment.

---

## Raw queries — always use tagged template literals

```typescript
// ✅ Safe — parameterized
const result = await this.prisma.$queryRaw<Course[]>`
  SELECT * FROM courses WHERE instructor_id = ${instructorId} AND status = ${status}
`;

// ❌ Unsafe — SQL injection
const result = await this.prisma.$queryRawUnsafe(
  `SELECT * FROM courses WHERE instructor_id = '${instructorId}'`
);
```

Prefer the Prisma query builder. Only use `$queryRaw` for queries that Prisma cannot express (e.g., full-text search, window functions).

---

## Indexes — add for every FK used in WHERE

Every FK field used in a `where` clause needs an index. Check `prisma/schema.prisma` when adding a new query pattern:

```prisma
model Lesson {
  id       String @id @default(cuid())
  moduleId String @map("module_id")

  @@index([moduleId])  // required — moduleId is used in WHERE frequently
}
```

---

## Repository pattern — services never call PrismaService

```typescript
// ✅ Correct — service calls its own repository
@Injectable()
export class LessonsService {
  constructor(private readonly lessonsRepository: LessonsRepository) {}
}

// ❌ Wrong — service calls Prisma directly
@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}
}
```

If you need a query that belongs to another domain, call that domain's service (not its repository).

---

## Reorder operations — validate IDs before updating

Before executing a bulk reorder, verify every ID in the payload belongs to the parent resource:

```typescript
async reorder(moduleId: string, dto: ReorderLessonsDto): Promise<void> {
  const existingIds = await this.repo.findIdsByModuleId(moduleId);
  const existing = new Set(existingIds);
  if (dto.items.some((item) => !existing.has(item.id))) {
    throw new BadRequestException('One or more lesson IDs do not belong to this module');
  }
  await this.repo.reorder(dto.items);
}
```

---

## Re-enrollment — always use upsert

When a user re-enrolls after cancellation, use `upsert` to avoid P2002:

```typescript
// ✅ Correct — handles both new and returning students
await this.prisma.enrollment.upsert({
  where: { userId_courseId: { userId, courseId } },
  create: { userId, courseId, status: 'ACTIVE' },
  update: { status: 'ACTIVE', cancelledAt: null },
});

// ❌ Wrong — throws P2002 on re-enrollment
await this.prisma.enrollment.create({ data: { userId, courseId, status: 'ACTIVE' } });
```

---

## Repository method conventions

```typescript
@Injectable()
export class ExampleRepository {
  constructor(private readonly prisma: PrismaService) {}

  // List — always return [T[], number] tuple with take limit
  async findMany(params: FindParams): Promise<[Entity[], number]> {
    const where = buildWhere(params);
    return this.prisma.$transaction([
      this.prisma.entity.findMany({ where, skip: params.skip, take: params.take }),
      this.prisma.entity.count({ where }),
    ]);
  }

  // Single — return T | null, never throw
  findById(id: string): Promise<Entity | null> {
    return this.prisma.entity.findUnique({ where: { id } });
  }

  // Scoped single — always include parent constraint
  findByIdInParent(id: string, parentId: string): Promise<(Entity & { parent: { topId: string } }) | null> {
    return this.prisma.entity.findFirst({
      where: { id, parentId },
      include: { parent: { select: { topId: true } } },
    });
  }

  // Write — use Prisma input types, never raw DTOs
  create(data: Prisma.EntityCreateInput): Promise<Entity> {
    return this.prisma.entity.create({ data });
  }

  update(id: string, data: Prisma.EntityUpdateInput): Promise<Entity> {
    return this.prisma.entity.update({ where: { id }, data });
  }

  delete(id: string): Promise<Entity> {
    return this.prisma.entity.delete({ where: { id } });
  }
}
```
