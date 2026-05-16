Perform a security review of **$ARGUMENTS**.

Read the specified file(s) and analyse them against the checklist below. For each finding report:
**[SEVERITY]** `file:line` — description → fix

Severity levels: **Critical** / **High** / **Medium** / **Low**

---

## Project-specific context

This is a NestJS 11 API with:
- Global guards: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` (in that order, via `APP_GUARD`)
- Global pipes: `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Global filter: `GlobalExceptionFilter` — maps Prisma P2002→409, P2025→404, P2003→400; swallows stack traces
- Global interceptors: `LoggingInterceptor`, `ResponseInterceptor` (skips wrapping on 204)
- Auth: JWT access tokens (15 min) + refresh tokens stored in Redis (7 days), rotated on use
- IDs: Prisma CUID (`@id @default(cuid())`) — must be validated with `@IsUUID()` in DTOs

---

## Checklist

### 1. Authentication & Authorization

- [ ] Routes that need no auth are marked `@Public()` — not "unprotected by accident"
- [ ] Routes that need auth have NO `@Public()` and no manual token check
- [ ] `@Roles()` is applied to every write endpoint (POST, PATCH, PUT, DELETE) — not just admin endpoints
- [ ] Role checks use `@Roles()` guard only — never `if (user.role !== 'ADMIN')` inside the handler
- [ ] JWT secret is never hardcoded — always read from `ConfigService<AppConfig>`
- [ ] Refresh token endpoint (`POST /auth/refresh`) has `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] WebSocket gateways verify the JWT in `handleConnection` and call `client.disconnect()` on failure

### 2. Input Validation — DTOs

- [ ] Every controller method that receives a body uses a typed DTO — no `@Body() body: any`
- [ ] Every controller method that receives query params uses a typed DTO — no `@Query() q: any`
- [ ] **UUID fields use `@IsUUID()`** — `@IsString()` is NOT acceptable for any FK or id field
- [ ] Optional UUID fields use `@IsOptional()` + `@IsUUID()` — not `@IsOptional()` + `@IsString()`
- [ ] String fields have `@MinLength(n)` where a minimum length makes sense
- [ ] Enum fields use `@IsEnum(TheEnum)` — not `@IsString()`
- [ ] Array fields have `@IsArray()` + element-level decorators (`@IsUUID('4', { each: true })`)
- [ ] Update DTOs extend `PartialType(CreateDto)` — not manually redeclared with all-optional fields

### 3. Input Validation — Path Parameters

- [ ] Every UUID path param uses `ParseUUIDPipe`: `@Param('id', ParseUUIDPipe) id: string`
- [ ] No bare `@Param('id') id: string` without pipe — accepts any string including injection attempts
- [ ] Non-UUID path params are validated against an explicit allowlist in the service

### 4. SQL / Prisma Safety

- [ ] No `prisma.$queryRaw` or `prisma.$executeRaw` with string interpolation
- [ ] If raw queries exist, they use tagged template literals: `` prisma.$queryRaw`SELECT ... WHERE id = ${id}` ``
- [ ] `orderBy` values are never built dynamically from user input without a hardcoded allowlist
- [ ] Compound unique lookups use the Prisma compound key syntax: `{ where: { userId_courseId: { userId, courseId } } }`

### 5. Sensitive Data Exposure

- [ ] `passwordHash` is never included in any response DTO
- [ ] Services always map through a private `map()` method — never `return rawPrismaObject`
- [ ] No `logger.log(user)` or similar full-object logging of entities
- [ ] `GlobalExceptionFilter` does not expose stack traces (verify it only logs, never returns, the stack)
- [ ] No secrets in comments, strings, or `.env` files committed to the repo

### 6. Rate Limiting

- [ ] Auth endpoints (login, register, refresh) have `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] File upload endpoints have a body size limit (global limit in `main.ts` is `10mb`)
- [ ] No `findMany` call in any repository is unbounded — every list query has a `take` parameter

### 7. Mass Assignment

- [ ] `whitelist: true` strips unknown fields globally — but DTOs must exist for it to work
- [ ] Update DTOs do not allow `id`, `createdAt`, `updatedAt`, or `role` to be updated (unless admin)
- [ ] `UsersRepository.update` accepts `Prisma.UserUpdateInput` — verify callers never pass `role` from user input
- [ ] `CoursesRepository.update` accepts `Prisma.CourseUpdateInput` — verify `instructorId` is not user-settable

### 8. CORS & Headers

- [ ] `helmet()` is applied in `main.ts` (it is — verify it has not been removed)
- [ ] CORS `origin` in `main.ts` uses `config.get('cors.origins')` — never hardcoded `'*'`
- [ ] `@WebSocketGateway` decorators have no `cors:` option — CORS is handled by `SocketIoCorsAdapter`

### 9. Error Handling

- [ ] All async service methods propagate exceptions — no swallowed `catch` blocks that hide failures
- [ ] No controller methods `throw new Error(...)` — only NestJS HTTP exceptions
- [ ] `GlobalExceptionFilter.catch` does not call `response.json()` with the raw Prisma error
- [ ] Logout and other token-invalidation paths have try/catch that swallows expired-token errors (expected behavior)

### 10. Cryptography & Secrets

- [ ] Passwords hashed with `bcrypt` at cost 12 — verify `BCRYPT_ROUNDS` constant
- [ ] Refresh token JTI uses `crypto.randomUUID()` — not `Math.random()`
- [ ] JWT secrets have minimum length enforced by Zod in `src/config/env.validation.ts`
- [ ] R2 storage keys are sanitized before use — never `user.originalFilename` directly as the S3 key

### 11. WebSocket-Specific

- [ ] Room names (`thread:${threadId}`) use validated UUIDs — `threadId` comes from a validated DTO
- [ ] Gateway event handlers validate their `@MessageBody()` payload — use typed DTOs, not `any`
- [ ] Broadcast events are scoped to the correct room — no `server.emit()` that reaches all connected clients

### 12. Repository Pattern Integrity

- [ ] No service injects `PrismaService` directly — only via its domain repository
- [ ] No controller injects a repository — only via the service
- [ ] No module exports a repository — only services are exported

---

## Output format

List every finding:

```
[HIGH] src/modules/courses/dto/create-course.dto.ts:14
Issue: categoryId uses @IsString() instead of @IsUUID()
Fix: Replace @IsString() with @IsUUID() and update the import
```

Then provide:

**Summary table**

| Severity | Count | Files affected |
|---|---|---|
| Critical | 0 | — |
| High | 2 | courses.dto.ts, messages.dto.ts |
| Medium | 1 | messages.repository.ts |
| Low | 0 | — |

**Overall risk rating:** Low / Medium / High / Critical

If a category has no issues, write "✅ No issues found."
