Review the code in **$ARGUMENTS** for quality, correctness, and maintainability.

Before starting: read `MISTAKES.md` and `.claude/skills/nestjs-patterns.md`. Every item in MISTAKES.md is a real pattern that has caused bugs — check for recurrence.

Read the target file(s) thoroughly. For every issue found, report:

```
[SEVERITY] file:line
Issue: <what is wrong and why it matters>
Fix: <concrete recommendation or corrected snippet>
```

Severity levels: **HIGH** / **MEDIUM** / **LOW** / **SUGGESTION**

---

## 1. Naming Conventions

- [ ] Variables and parameters: `camelCase` — no `snake_case`, no `PascalCase`
- [ ] Classes, types, interfaces, enums: `PascalCase`
- [ ] Constants (module-level, never reassigned): `UPPER_SNAKE_CASE`
- [ ] File names: `kebab-case.ts`
- [ ] No abbreviations unless universally understood (`id`, `url`, `dto` are fine; `usr`, `crs` are not)
- [ ] Boolean variables named with `is`/`has`/`can` prefix (`isPublished`, `hasAccess`, `canEnroll`)
- [ ] Methods named with verb+noun (`createCourse`, `findById`, `removeResource`)

---

## 2. Architecture Compliance

- [ ] Controllers contain routing only — no business logic, no Prisma, no Redis
- [ ] Services contain business logic — no `Request`/`Response` objects, no direct Prisma
- [ ] Repositories contain all Prisma calls — no business logic, no HTTP concerns
- [ ] No service injects `PrismaService` directly — must go through its own repository
- [ ] No controller injects a repository — must go through the service
- [ ] No module exports a repository — only services are exported
- [ ] Cross-module data access goes through the exported service, never the repository
- [ ] No circular dependencies (A imports B, B imports A)
- [ ] `@Global()` used only for `PrismaModule` and `RedisModule` — never feature modules

---

## 3. TypeScript Strict Mode

- [ ] No `any` type without a `// justification` comment
- [ ] No type assertions (`as SomeType`) that could hide runtime errors — use type guards instead
- [ ] No non-null assertions (`!`) without a comment explaining why it's guaranteed
- [ ] All exported functions and methods have explicit return type annotations
- [ ] `unknown` values narrowed before access — no direct property access on `unknown`
- [ ] All parameters typed — no implicit `any` parameters
- [ ] `type` imports used for type-only imports (`import type { Foo } from '...'`)

---

## 4. Async Patterns

- [ ] All `Promise`-returning methods are `async` or explicitly return the `Promise` — no floating promises
- [ ] No `.then()` / `.catch()` chains in NestJS code — always `await`
- [ ] No `Promise.all` wrapping sequential dependent operations (use sequential `await`)
- [ ] `await` used on every repository call in services
- [ ] No `void` cast to silence unhandled promise (`void asyncCall()`) without documented reason
- [ ] Background fire-and-forget is explicitly documented (`void` with comment)

---

## 5. SOLID Principles

- **S — Single Responsibility:** Does each class do exactly one thing? Service = business logic only. Repository = data access only.
- **O — Open/Closed:** Is logic hardcoded instead of delegated? Check for `if (type === 'VIDEO')` sprawl in services.
- **L — Liskov:** Do subtypes behave as expected? Check DTOs extending `PartialType`.
- **I — Interface Segregation:** Are any DTOs or interfaces too fat? Check if DTOs mix input and output concerns.
- **D — Dependency Inversion:** Are concrete classes injected instead of their tokens? NestJS DI handles this — check for `new Service()` calls.

---

## 6. NestJS Conventions

- [ ] `ParseUUIDPipe` on every UUID path parameter
- [ ] `@HttpCode(HttpStatus.NO_CONTENT)` on every DELETE endpoint
- [ ] `@Roles()` on every write endpoint (POST, PATCH, PUT, DELETE)
- [ ] `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) for update DTOs
- [ ] Static routes declared before parameterized routes (`/me` before `/:id`)
- [ ] No `@Public()` on endpoints that should require auth
- [ ] No `@Body() body: any` — always a typed DTO
- [ ] `@CurrentUser()` used to access the JWT user — never re-fetch from DB in controller
- [ ] `private readonly` on all injected dependencies (not `protected readonly` unless methods not yet implemented)

---

## 7. Performance

- [ ] No N+1 queries: no repository call inside a loop
- [ ] `include` and `select` scoped to needed fields only — no `include: { everything: true }`
- [ ] All `findMany` calls have `take` limit from pagination or a hardcoded constant
- [ ] Expensive reads (course lists, enrollment counts) have Redis cache opportunities noted
- [ ] No synchronous heavy computation blocking the event loop (image processing, large sort, etc.)
- [ ] Prisma `$transaction` used for atomic multi-step writes

---

## 8. Error Handling

- [ ] No swallowed `catch {}` blocks — either log and re-throw, or handle the specific expected case
- [ ] No `throw new Error(...)` in services — only NestJS HTTP exceptions
- [ ] No `throw new InternalServerErrorException(originalError.message)` — exposes internals
- [ ] Missing `NotFoundException` when a resource is not found before an operation
- [ ] Try/catch in logout and token revocation swallows only `JsonWebTokenError` and `TokenExpiredError` — not all errors

---

## 9. Security (quick check — full audit via /security-review)

- [ ] No `@IsString()` on a UUID/CUID field — must be `@IsUUID()`
- [ ] No hardcoded secrets, tokens, or passwords
- [ ] Response DTOs never include `passwordHash`, raw tokens, or internal state
- [ ] No `console.log` — all logging through `Logger`
- [ ] Auth endpoints have `@Throttle()` applied

---

## 10. Code Quality

- [ ] Functions and methods ≤ 30 lines — split if longer
- [ ] Nesting depth ≤ 3 levels — use early returns to flatten
- [ ] No magic numbers or strings — extract to named constants
- [ ] No duplicated logic — extract to private method or utility
- [ ] No dead code: no commented-out code, no unreachable branches, no unused exports
- [ ] No misleading variable or method names (e.g., `update()` that deletes, `list` that returns one)
- [ ] Comments only where the WHY is non-obvious — no "this calls the repo" comments

---

## 11. Tests (if spec files included)

- [ ] Every `it()` description states the expected behavior, not the implementation (`'throws NotFoundException when course not found'` not `'should work'`)
- [ ] Every happy path has a corresponding error path test
- [ ] Mock return values reflect realistic Prisma output (no `{} as any`)
- [ ] Assertions verify the result, not just that a mock was called
- [ ] `jest.clearAllMocks()` in `afterEach`
- [ ] No test that passes regardless of implementation (empty test, always-truthy assertion)
- [ ] Repository mock type uses `Pick<Repository, 'method1' | 'method2'>` — not `jest.Mocked<Repository>`

---

## Output format

Group findings by severity, then by category:

```
## HIGH

### Architecture
[HIGH] src/modules/courses/courses.service.ts:45
Issue: PrismaService injected directly — bypasses repository pattern, breaks test isolation
Fix: Inject CoursesRepository instead; move Prisma call to repository

### TypeScript
[HIGH] src/modules/courses/dto/create-course.dto.ts:12
Issue: categoryId uses @IsString() — accepts garbage strings including SQL injection attempts
Fix: Replace with @IsUUID()

## MEDIUM
...

## LOW
...

## SUGGESTION
...
```

End with a summary:

**Overall code quality:** Excellent / Good / Needs Work / Poor

**Top 3 priority fixes:**
1. ...
2. ...
3. ...

**What was done well:**
- ...
