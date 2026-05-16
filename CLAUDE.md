# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

Custom commands live in `.claude/commands/`. Invoke with `/command-name <arguments>`.

### `/new-module <ModuleName>`

Creates a complete NestJS module: entity, DTOs (create/update/response), repository, service, controller, module file, and unit tests.

```
/new-module Course
/new-module ForumThread
```

After running: register the new module in `src/app.module.ts`, then run `pnpm build` to verify.

### `/new-dto <DtoName> [field:type ...]`

Creates a validated DTO with `class-validator` and `class-transformer` decorators.

```
/new-dto CreateUserDto email:string firstName:string lastName:string password:string role:enum
/new-dto UpdateCourseDto title:string? description:string? price:number?
```

Trailing `?` marks optional fields.

### `/security-review <path>`

Reviews a file or module for security vulnerabilities: auth bypass, unvalidated inputs, sensitive data exposure, SQL injection risks, missing rate limits.

```
/security-review src/modules/auth
/security-review src/modules/users/users.controller.ts
```

### `/db-migration <description>`

Guides through creating a Prisma migration safely: risk assessment, SQL preview, rollback documentation.

```
/db-migration add price column to courses table
/db-migration rename user.name to firstName and lastName
```

### `/code-review <path>`

Reviews code for SOLID principles, TypeScript correctness, NestJS conventions, performance, and security.

```
/code-review src/modules/enrollments
/code-review src/modules/auth/auth.service.ts
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
| `JWT_EXPIRES_IN` | ✅ | e.g. `7d` |
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

## Code conventions

- All code, comments, variable names, function names, and class names in **English**
- Strict TypeScript: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` enabled
- Stub/placeholder service and controller constructors use `protected readonly` (not `private`) to avoid TS6138 errors while methods are empty — change to `private` once methods are added
- DTOs use `class-validator`; `whitelist: true` + `forbidNonWhitelisted: true` is global
- No `console.log` in source — use NestJS `Logger`
- All API responses in English
