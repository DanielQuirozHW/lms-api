# CLAUDE.md

⚠️ Always read `MISTAKES.md` before generating any code in this project.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Before implementing any feature — 5-step checklist

1. **Read `MISTAKES.md`** — check whether the feature touches any pattern that has caused a vulnerability before (BOLA, session management, WebSocket input, Redis usage, visibility filtering).
2. **Read the relevant skill** — identify which `.claude/skills/` file applies and read it before writing code.
3. **Verify the parent resource ownership chain** — if the feature operates on a nested resource (lesson/module/enrollment), write down the full chain before touching any repository method.
4. **Plan unit tests first** — identify the NotFoundException, ForbiddenException, and ConflictException cases before implementing the happy path.
5. **Run `/security-review` on the new files** — after generating, run a security review before marking the task complete.

---

## Available Skills

Skills are reference documents in `.claude/skills/`. Read the relevant skill before writing code in that area.

| Skill | File | Use when |
|---|---|---|
| NestJS Security | `.claude/skills/nestjs-security.md` | Writing guards, JWT handling, WebSocket auth, ownership checks, Redis token management |
| Prisma Patterns | `.claude/skills/prisma-patterns.md` | Writing repository methods, schema changes, migrations, transactions |
| NestJS Architecture | `.claude/skills/nestjs-patterns.md` | Creating modules, deciding where logic lives, wiring dependencies, cross-module access |
| API Design | `.claude/skills/api-design.md` | Designing endpoints, choosing HTTP status codes, pagination, Swagger docs |
| Error Handling | `.claude/skills/error-handling.md` | Exception handling, logging, filters, what to log vs. omit |

---

## Available Commands

Commands live in `.claude/commands/`. Invoke with `/command-name <arguments>`.

| Command | Description |
|---|---|
| `/new-module <ModuleName>` | Generate a complete NestJS module with all 9 files (entity, DTOs, repository, service, controller, module, spec) |
| `/security-review <path>` | Full OWASP + LMS BOLA + WebSocket + business logic security audit |
| `/code-review <path>` | Architecture, TypeScript, SOLID, naming, async patterns, tests |
| `/pre-commit-check <path>` | Scan for secrets, console.log, any type, missing pipes, arch violations |
| `/post-generate-check <path>` | Verify generated module is wired: AppModule, providers, exports, Swagger, pipes |
| `/new-dto <DtoName> [field:type...]` | Create a validated DTO with class-validator decorators |
| `/db-migration <description>` | Safe Prisma migration: risk assessment, SQL preview, rollback docs |

## Project

Backend REST API for an LMS (Learning Management System) built with:
- **NestJS 11** — framework with strict TypeScript
- **Prisma 7** (prisma-client-js) + **PostgreSQL 16** — ORM + database
- **Redis 7** via ioredis — caching, sessions, pub/sub
- **Socket.io** via @nestjs/websockets — real-time (forum, messages)
- **Cloudflare R2** via @aws-sdk/client-s3 — file storage (S3-compatible)
- **pnpm** — package manager
- **Railway** — deployment target

---

## Commands

```bash
# Development
pnpm start:dev              # watch mode
pnpm build                  # compile to dist/
pnpm start:prod             # run compiled output

# Testing
pnpm test                   # run unit tests
pnpm test:watch             # watch mode
pnpm test:cov               # with coverage
pnpm test:e2e               # end-to-end tests
pnpm test -- --testPathPattern=health   # run a single spec file

# Linting & formatting
pnpm lint                   # ESLint with auto-fix
pnpm format                 # Prettier

# Prisma
pnpm prisma:generate        # regenerate client after schema changes
pnpm prisma:migrate         # create + apply migration (dev)
pnpm prisma:migrate:deploy  # apply migrations (production)
pnpm prisma:studio          # open Prisma Studio GUI

# Docker (local infra)
pnpm docker:up              # start PostgreSQL 16 + Redis 7
pnpm docker:down            # stop containers
```

---

## Running locally with Docker

```bash
pnpm docker:up              # start postgres + redis
cp .env.example .env        # already done; adjust values if needed
pnpm prisma:migrate         # run migrations and generate client
pnpm start:dev              # API at http://localhost:3000
```

Health check: `GET http://localhost:3000/api/v1/health`

---

## Architecture decisions and reasoning

### Why NestJS modules
Each domain (auth, users, courses, etc.) lives in its own NestJS module under `src/modules/`. This enforces explicit boundaries — a module's internals are only exposed if exported. It prevents accidental coupling and makes each domain independently testable. New developers can work on `CoursesModule` without needing to understand `ForumModule`.

### Why Prisma
Prisma's generated type-safe client eliminates an entire class of runtime errors at the ORM layer. Combined with TypeScript strict mode, a wrong field name or type mismatch is caught at compile time, not in production. Prisma migrations are version-controlled SQL that can be reviewed, rolled back, and audited — unlike `sync`-style ORMs that modify production schemas silently.

### Why Redis for sessions and cache
Redis is used for:
1. **JWT refresh token storage** — storing token metadata allows instant revocation without waiting for expiry.
2. **Rate limiting state** — `ThrottlerModule` uses in-memory by default, which resets on restart; Redis makes rate limits survive deploys.
3. **Short-lived cache** — e.g., course lists, enrollment counts — expensive queries that don't change every request.
4. **Pub/sub for Socket.io** — when scaling to multiple Railway instances, Socket.io needs a shared pub/sub layer so events broadcast from instance A reach clients on instance B.

### Why Global modules for Prisma and Redis
`PrismaModule` and `RedisModule` are `@Global()`. Almost every feature module needs database access. Requiring every module to import `PrismaModule` is pure boilerplate with no architectural benefit. Global modules are appropriate when the service is truly app-wide infrastructure — not a domain concern.

### Why the Repository pattern
Services call repositories; repositories call Prisma. This means:
- Business logic is testable without a database (mock the repository, not Prisma).
- If Prisma is ever replaced, only repositories change — services and controllers are unaffected.
- Complex query logic is co-located and named (e.g., `findPublishedWithEnrollmentCount`) rather than scattered across services.

### Why ResponseInterceptor wraps all responses
Consistent envelope `{ data, timestamp }` means the frontend can always destructure `response.data` regardless of endpoint. It also lets us add pagination metadata, request IDs, or deprecation warnings in one place without touching controllers.

---

## Folder structure conventions

```
src/
├── config/             Infrastructure config (env vars, typed config factory)
├── prisma/             Database client — global, inject PrismaService directly
├── redis/              Redis client — global, inject RedisService directly
├── storage/            File storage — NOT global, import StorageModule explicitly
├── common/
│   ├── decorators/     Parameter and metadata decorators (@CurrentUser, @Public, @Roles)
│   ├── dto/            Shared DTOs used across modules (PaginationDto)
│   ├── filters/        Global exception filter — one place to shape error responses
│   ├── guards/         Global and reusable guards (JwtAuthGuard, RolesGuard)
│   ├── interceptors/   Global interceptors (ResponseInterceptor, LoggingInterceptor)
│   └── pipes/          Custom pipes (ParseUUIDPipe overrides, etc.)
├── health/             Single controller, no service needed — keep it flat
└── modules/            One folder per domain bounded context
    └── <domain>/
        ├── dto/                create, update, response DTOs
        ├── strategies/         Passport strategies (auth module only)
        ├── <domain>.entity.ts  TypeScript type mirroring the Prisma model
        ├── <domain>.repository.ts  All Prisma calls for this domain
        ├── <domain>.service.ts     Business logic
        ├── <domain>.controller.ts  HTTP routing only
        ├── <domain>.module.ts
        ├── <domain>.gateway.ts     Socket.io gateway (if real-time needed)
        └── <domain>.service.spec.ts
```

**Where each file type goes:**
- **DTOs**: always in `dto/` subfolder of the module that owns them. Shared DTOs go in `src/common/dto/`.
- **Guards**: auth guards in `src/common/guards/`; domain-specific guards (e.g., `CourseOwnerGuard`) in the module's folder.
- **Decorators**: reusable decorators in `src/common/decorators/`; single-use decorators inline in the file.
- **Types/interfaces**: define locally if used in one file; move to `*.entity.ts` or `*.types.ts` if shared within the module; move to `src/common/` if shared across modules.
- **Constants**: next to the file that uses them. No global constants file.

---

## Security rules — always follow these

1. **Never trust user input.** Every controller param — body, query, path — must be typed through a DTO with `class-validator` decorators. Never use `@Body() body: any`.

2. **Always validate with DTOs.** The global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true`. This strips unknown fields — but a DTO must exist for this to work.

3. **Never expose internal errors or stack traces.** `GlobalExceptionFilter` handles this. Never catch an error and re-throw it with the raw stack trace. In non-development environments, return only the message.

4. **Always use guards for protected routes.** When JwtAuthGuard is added globally, use `@Public()` to opt out. Never rely on "no one will call this endpoint without a token" — it will be called.

5. **Always hash passwords.** Use bcrypt (cost ≥ 10) or argon2. Never store, log, or return plaintext passwords. The response DTO must never include `passwordHash`.

6. **Never log sensitive data.** Do not log passwords, tokens, full user objects, or payment data. Use structured logging with explicit field selection.

7. **Validate path parameters.** UUIDs must go through `ParseUUIDPipe` or have `@IsUUID()` in a DTO. Arbitrary string IDs must be validated against an allowlist where possible.

8. **Never use raw Prisma queries with string interpolation.** If `$queryRaw` is necessary, use tagged template literals. Prisma's query builder is safe by default — use it.

9. **Rate limit auth endpoints strictly.** Login and register should have a tighter throttler than the global default (e.g., 5 requests / minute). Apply at the controller level using `@Throttle()`.

10. **Sanitize before storage.** File names from uploads must be sanitized before use as storage keys. Never use user-supplied file names directly.

---

## API response format conventions

### Success responses

All successful responses are wrapped by `ResponseInterceptor`:
```json
{
  "data": <payload>,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Paginated responses:
```json
{
  "data": {
    "data": [...],
    "meta": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
  },
  "timestamp": "..."
}
```

### Error responses

All errors go through `GlobalExceptionFilter`:
```json
{
  "statusCode": 404,
  "message": "Course not found",
  "error": "Not Found",
  "path": "/api/v1/courses/abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### HTTP status codes

| Operation | Status |
|---|---|
| GET (found) | 200 |
| POST (created) | 201 |
| PATCH / PUT (updated) | 200 |
| DELETE (deleted) | 204 (no body) |
| Not found | 404 |
| Validation failed | 400 |
| Unauthorized (no/invalid token) | 401 |
| Forbidden (valid token, wrong role) | 403 |
| Conflict (duplicate) | 409 |
| Rate limited | 429 |

---

## Git workflow

### Commit format (Conventional Commits)

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`

Examples:
```
feat(courses): add course search with filters
fix(auth): prevent refresh token reuse after rotation
chore(deps): upgrade prisma to 7.8.0
test(enrollments): add edge case for double enrollment
refactor(users): extract password hashing to utility function
```

### Branch naming

```
feature/<short-description>    # new functionality
fix/<short-description>        # bug fix
chore/<short-description>      # maintenance, deps, tooling
hotfix/<short-description>     # urgent production fix
```

Examples: `feature/jwt-refresh-rotation`, `fix/enrollment-duplicate-check`, `hotfix/cors-header-missing`

### Automated commit validation

Commits are validated automatically via Husky git hooks:

- **pre-commit** — runs `lint-staged`: ESLint (auto-fix) + Prettier on every staged `*.ts` file
- **commit-msg** — runs `commitlint`: enforces Conventional Commits format, allowed types, and 100-char header limit

If either hook fails, the commit is aborted. Fix the reported issue, re-stage, and retry.
The hooks are installed automatically when you run `pnpm install` (via the `prepare` script).

### PR rules

- PRs target `develop` (not `main`)
- `main` receives merges from `develop` for releases only
- PR title follows Conventional Commits format
- At least one passing CI run before merge
- `pnpm build` and `pnpm test` must pass

---

## Custom commands

See the **Available Commands** table at the top of this file for the full list. All commands live in `.claude/commands/`.

Usage examples:
```
/new-module Payments
/security-review src/modules/auth
/code-review src/modules/enrollments
/pre-commit-check src/modules/courses
/post-generate-check src/modules/payments
/db-migration add price column to courses table
/new-dto CreatePaymentDto amount:number courseId:uuid
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string |
| `REDIS_HOST` | ✅ | Redis hostname |
| `REDIS_PORT` | ✅ | Redis port (default 6379) |
| `REDIS_PASSWORD` | | Redis password (blank for local) |
| `JWT_SECRET` | ✅ | Min 32 chars — signs access tokens |
| `JWT_EXPIRES_IN` | ✅ | e.g. `15m` — access token lifetime |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars — signs refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | e.g. `30d` |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed origins |
| `THROTTLE_TTL` | | Rate limit window in ms (default 60000) |
| `THROTTLE_LIMIT` | | Max requests per window (default 100) |
| `R2_ACCOUNT_ID` | | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | | R2 access key |
| `R2_SECRET_ACCESS_KEY` | | R2 secret key |
| `R2_BUCKET_NAME` | | R2 bucket (default `lms-assets`) |
| `R2_PUBLIC_URL` | | Public CDN URL for uploaded files |

Validation runs at startup via Zod in `src/config/env.validation.ts`. Missing required vars crash immediately with a descriptive message — no silent failures.

---

## Prisma schema conventions

- All table names `snake_case` via `@@map`; all column names via `@map`
- IDs: `@id @default(cuid())`
- Timestamps: `createdAt DateTime @default(now()) @map("created_at")` + `updatedAt DateTime @updatedAt @map("updated_at")`
- `User.role` enum: `STUDENT | INSTRUCTOR | ADMIN`
- `Course.status` enum: `DRAFT | PUBLISHED | ARCHIVED`
- Lessons nested under courses (`courseId` FK + `@@unique([courseId, order])`)
- `LessonProgress` tracks per-enrollment lesson completion
- `ForumThread.courseId` optional — supports both course-scoped and global threads
- `ForumPost.parentId` self-referential — supports nested replies

After any schema change: `pnpm prisma:migrate` (dev) or `pnpm prisma:generate` (types only).

---

## Schema standards

Every model in this schema follows Dataverse-style audit conventions. These rules are enforced across all models unless explicitly listed as exceptions below.

### Standard fields — required on every model

```prisma
id        String   @id @default(cuid())
isActive  Boolean  @default(true)  @map("is_active")
createdBy String?  @map("created_by")
updatedBy String?  @map("updated_by")
createdAt DateTime @default(now()) @map("created_at")
updatedAt DateTime @updatedAt      @map("updated_at")
```

### Soft-delete — never hard-delete

The portal never issues `DELETE` SQL on user-facing records. Removal is always `UPDATE … SET is_active = false`. Hard deletes are reserved for cascade cleanup defined at the DB constraint level (e.g. `onDelete: Cascade` on child FK relations when the parent is removed).

### createdBy / updatedBy population

- **User-initiated actions**: set to the authenticated user's id from the JWT payload (`@CurrentUser()`).
- **Automated processes** (cron jobs, background workers, system events): set to the system user email `system@nexuslms.internal`.
- Both fields are `String?` (nullable) in the schema — `null` means the record predates this convention; treat it as unknown, not as a bug.

### Exception models — immutable audit records

The following models are append-only event logs. They must **not** have `isActive` or `updatedBy` because they are never modified after creation:

| Model | Reason |
|---|---|
| `SystemError` | Immutable error log |
| `LoginEvent` | Immutable auth audit trail |
| `PasswordResetToken` | Single-use token, never updated |
| `ImpersonationLog` | Immutable admin audit trail |
| `EnrollmentCodeUsage` | Immutable redemption record |
| `QuizAnswer` | Immutable student answer record |
| `ForumPostVote` | Immutable vote record |

Exception models still receive `createdBy` and `createdAt`. They do **not** get `updatedAt`, `updatedBy`, or `isActive`.

### Semantic date fields — keep as business events

Some fields represent domain events, not schema timestamps. Do **not** rename or remove them:

| Field | Model | Meaning |
|---|---|---|
| `completedAt` | `Enrollment`, `QuizAttempt` | When the work was finished |
| `gradedAt` | `Enrollment`, `Submission` | When a grade was assigned |
| `assessedAt` | `RubricAssessment` | When the rubric was scored |
| `startedAt` | `LessonProgress`, `ImpersonationLog` | When the activity began |
| `lastWatchedAt` | `LessonProgress` | Last video resume point |
| `endedAt` | `ImpersonationLog` | When impersonation ended |

These coexist with `createdAt`/`updatedAt` — they are not replacements for those fields.

### Adding a new model — schema checklist

1. Add the six standard fields in the order shown above (id → isActive → createdBy → updatedBy → createdAt → updatedAt).
2. If the model is an append-only event log, omit `isActive` and `updatedBy` and document the exception in this file.
3. Use `@map` on every field and `@@map` on the model for `snake_case` column names.
4. If the model records a domain event (started, completed, graded…), add the semantic date field **in addition to** `createdAt`.

---

## Code conventions

- All code, comments, variable names, function names, and class names in **English**
- Strict TypeScript: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` enabled
- Stub/placeholder service and controller constructors use `protected readonly` (not `private`) to avoid TS6138 errors while methods are empty — change to `private` once methods are added
- DTOs use `class-validator`; `whitelist: true` + `forbidNonWhitelisted: true` is global
- No `console.log` in source — use NestJS `Logger`
- All API responses in English
- JSDoc on public service methods: one-line summary only. Skip if the method name is fully self-documenting. Required when there is a non-obvious behavior (e.g., silent success on expired token, side effects like token rotation).
- `CreateXxxDto` must never include `status`, `role`, or any field that sets an entity's lifecycle state — those belong in dedicated update/transition endpoints only. Courses always start as `DRAFT`; users always start as `STUDENT`.

### PrismaService pattern

`PrismaService` does not use `process.env` directly. It is instantiated via a factory provider in `PrismaModule` that injects `ConfigService`. This ensures the database URL goes through the same Zod-validated config as all other environment variables:

```typescript
// prisma.module.ts — factory pattern (do not revert to class provider)
{
  provide: PrismaService,
  useFactory: (config: ConfigService<AppConfig>): PrismaService =>
    new PrismaService(config.get('database.url', { infer: true }) as string),
  inject: [ConfigService],
}
```

---

## Development Patterns

### Adding a new module — step-by-step checklist

Follow this order exactly. Skipping steps causes TypeScript errors or silent runtime failures.

**Step 1 — Entity type** (`<domain>.entity.ts`)

Re-export the Prisma type. If the model does not exist yet, define a plain interface with a TODO.

```typescript
// src/modules/courses/courses.entity.ts
import type { Course } from '@prisma/client';
export type CourseEntity = Course;
```

**Step 2 — DTOs** (`dto/`)

- `create-<domain>.dto.ts` — all required fields with class-validator decorators
- `update-<domain>.dto.ts` — always `PartialType(CreateDto)`, never copy-paste
- `<domain>-response.dto.ts` — the shape the API returns; never include `passwordHash` or any secret field

**Step 3 — Repository** (`<domain>.repository.ts`)

Inject `PrismaService` with `private readonly`. Return Prisma types. Use `Prisma.XxxCreateInput` / `Prisma.XxxUpdateInput` for writes. Use `$transaction([findMany, count])` for paginated lists.

**Step 4 — Service** (`<domain>.service.ts`)

Inject the repository with `private readonly` (not PrismaService directly). Map every returned entity through a private `map(entity): ResponseDto` method. Throw NestJS HTTP exceptions — never raw `Error`.

**Step 5 — Controller** (`<domain>.controller.ts`)

Inject the service with `private readonly`. Use `ParseUUIDPipe` on every UUID path param. Use explicit return types. Add `@HttpCode(HttpStatus.NO_CONTENT)` on DELETE. Add `@Roles()` on every write endpoint.

**Step 6 — Module** (`<domain>.module.ts`)

Register service and repository in `providers`. Export only the service. Import `JwtModule.register({})` only if the module has a WebSocket gateway.

**Step 7 — Register in `app.module.ts`**

Add the module to the `imports` array.

**Step 8 — Tests** (`<domain>.service.spec.ts`)

Mock the repository with `jest.fn()`. Cover: not-found throws `NotFoundException`, create calls repository correctly, list returns paginated result.

**Step 9 — Build**

Run `pnpm build` and fix all TypeScript errors before continuing.

---

### Repository structure

```typescript
@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {} // always private

  // Paginated list — return [data, total] tuple, never throw
  async findMany(params: FindCoursesParams): Promise<[Course[], number]> {
    const where: Prisma.CourseWhereInput = {
      ...(params.status && { status: params.status }),
      ...(params.instructorId && { instructorId: params.instructorId }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);
    return [data, total];
  }

  // Single lookup — return T | null, never throw
  findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { id } });
  }

  // Writes — use Prisma input types for compile-time safety
  create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }
}
```

**Repository rules:**
- Never throw — return `null` on miss; let the service decide whether that is an error
- Never contain business logic — only Prisma calls
- Never accept raw DTOs as parameters — use typed objects or `Prisma.XxxInput`
- Every `findMany` must have a `take` limit — either from pagination params or a hardcoded constant
- `GlobalExceptionFilter` handles P2002→409, P2025→404, P2003→400 automatically

---

### DTO validation — field type map

| Field type | Required decorators |
|---|---|
| Any UUID (FK, id) | `@IsUUID()` |
| Free-form string | `@IsString()` + `@MinLength(n)` |
| Email | `@IsEmail()` |
| Enum | `@IsEnum(TheEnum)` |
| Integer | `@IsInt()` + `@Min(0)` |
| Float | `@IsNumber()` |
| Boolean | `@IsBoolean()` |
| URL | `@IsUrl()` |
| Optional field | `@IsOptional()` — always the first decorator |
| UUID array | `@IsArray()` + `@IsUUID('4', { each: true })` |

**The most common mistake:** using `@IsString()` on a UUID field. It accepts any string including garbage input. Always use `@IsUUID()` for any field that holds a cuid/uuid.

---

### Service — error handling pattern

```typescript
@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async findById(id: string): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.findById(id);
    if (!course) throw new NotFoundException('Course not found');
    return this.map(course);
  }

  async create(instructorId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.create({
      ...dto,
      slug: slugify(dto.title),
      instructor: { connect: { id: instructorId } },
    });
    return this.map(course);
    // P2002 (duplicate slug) → automatically becomes 409 via GlobalExceptionFilter
  }

  async remove(id: string): Promise<void> {
    await this.findById(id); // throws 404 if not found before attempting delete
    await this.coursesRepository.delete(id);
  }

  private map(course: Course): CourseResponseDto {
    // explicit mapping ensures only intended fields are returned
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
```

**Error rules:**
- Repositories return `null` on miss; services throw `NotFoundException`
- Prisma unique violations (P2002) bubble up and are caught by `GlobalExceptionFilter` → 409
- Never catch-and-re-throw with raw stack traces
- Never throw `InternalServerErrorException` manually — let unhandled exceptions propagate to the filter

---

### Controller — endpoint pattern

```typescript
@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {} // private once implemented

  @Get()
  findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<CourseResponseDto>> {
    return this.coursesService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CourseResponseDto> {
    return this.coursesService.findById(id);
  }

  @Post()
  @Roles('INSTRUCTOR', 'ADMIN')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles('INSTRUCTOR', 'ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('INSTRUCTOR', 'ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coursesService.remove(id);
  }
}
```

**Controller rules:**
- `ParseUUIDPipe` on every UUID path param — never bare `@Param('id') id: string`
- `@Roles()` on every write endpoint (POST, PATCH, PUT, DELETE)
- `@HttpCode(HttpStatus.NO_CONTENT)` on DELETE — `ResponseInterceptor` skips wrapping on 204
- Never re-fetch the user from DB in the controller — use `@CurrentUser()` which returns the JWT payload
- Never put business logic in controllers — delegate entirely to the service

---

### Cross-module data access

When module B needs data owned by module A:

```typescript
// ✅ Correct — import the module, inject the service
@Module({
  imports: [CoursesModule], // CoursesModule exports CoursesService
  providers: [EnrollmentsService, EnrollmentsRepository],
})
export class EnrollmentsModule {}

// In EnrollmentsService:
constructor(
  private readonly enrollmentsRepository: EnrollmentsRepository,
  private readonly coursesService: CoursesService, // ✅ service, not repository
) {}
```

```typescript
// ❌ Wrong — never inject another module's repository
constructor(private readonly coursesRepository: CoursesRepository) {}
```

Only export services from modules. Repositories are internal implementation details.

---

### WebSocket gateway pattern

Gateways that need JWT authentication must import `JwtModule.register({})` in their module and inject `JwtService` + `ConfigService`. Never put CORS config on the `@WebSocketGateway` decorator — CORS is applied globally by `SocketIoCorsAdapter` in `main.ts`.

```typescript
@WebSocketGateway({ namespace: '/forum' }) // no cors: option here
export class ForumGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  handleConnection(client: Socket): void {
    const user = this.authenticate(client);
    if (!user) { client.disconnect(); return; }
    (client.data as Record<string, unknown>)['user'] = user;
  }

  // token from handshake.auth.token OR Authorization header
  private authenticate(client: Socket): AuthenticatedUser | null { ... }
}
```

---

### Common mistakes to avoid

| Mistake | Consequence | Fix |
|---|---|---|
| `@IsString()` on a UUID field | Accepts garbage, SQL strings, anything | `@IsUUID()` |
| Bare `@Param('id') id: string` | Accepts non-UUID strings, no 400 on bad input | `@Param('id', ParseUUIDPipe) id: string` |
| Injecting `PrismaService` in a service | Breaks testability, violates repository pattern | Inject the domain repository |
| Returning raw Prisma objects | May expose `passwordHash` or future sensitive fields | Always map through `private map()` |
| `protected readonly` after adding methods | TS6138 suppressed — hides real accidental usage | Change to `private readonly` |
| Missing `@HttpCode(204)` on DELETE | Returns 200 with `{ data: null }` instead of empty 204 | Add `@HttpCode(HttpStatus.NO_CONTENT)` |
| Unbounded `findMany` without `take` | DoS vector on large tables | Add `take` from `PaginationDto` or a constant |
| Exporting a repository from its module | Breaks encapsulation; other modules bypass the service layer | Export only the service |
| `cors:` option on `@WebSocketGateway` | Ignored — CORS is controlled by `SocketIoCorsAdapter` | Remove it; configure in `main.ts` |
| No `@Throttle()` on credential endpoints | Brute-force possible | `@Throttle({ default: { limit: 5, ttl: 60000 } })` |
