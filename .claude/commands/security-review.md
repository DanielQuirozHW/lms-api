Perform a security review of **$ARGUMENTS**.

Before starting: read `MISTAKES.md` and `.claude/skills/nestjs-security.md`. Every item in MISTAKES.md represents a real vulnerability found in this codebase — check for recurrence.

Read the target file(s) thoroughly, then evaluate every section below. Report every finding as:

```
[SEVERITY] file:line
Issue: <what is wrong>
Fix: <concrete code change or pattern>
MISTAKES.md ref: <[NNN] if applicable>
```

Severity levels: **CRITICAL** / **HIGH** / **MEDIUM** / **LOW** / **INFORMATIONAL**

---

## Project context

NestJS 11 LMS API. Global guard chain: `ThrottlerGuard → JwtAuthGuard → RolesGuard`. Global pipe: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`. Global filter: `GlobalExceptionFilter` (maps P2002→409, P2025→404, P2003→400). Auth: JWT access (15m) + refresh tokens in Redis (30d), rotated on use. IDs: Prisma CUID.

---

## OWASP Top 10 Checklist

### A01 — Broken Access Control

- [ ] All write endpoints have `@Roles()` applied
- [ ] All UUID path params use `ParseUUIDPipe`
- [ ] Resource lookups verify the complete parent ownership chain — not just top-level (see [001])
- [ ] Non-PUBLISHED resources return 404 (not 403) to unauthorized viewers (see [007])
- [ ] Self-operation checks: vote/rate/review/enrollment checks `resource.ownerId !== user.id` (see [008])
- [ ] Instructor self-enrollment is blocked (see [008])
- [ ] Deleted/archived resources are inaccessible without explicit admin flag

### A02 — Cryptographic Failures

- [ ] Passwords hashed with bcrypt cost ≥ 12 (`BCRYPT_ROUNDS = 12`)
- [ ] JWT secrets minimum 32 characters, validated by Zod in `env.validation.ts`
- [ ] Refresh token JTI uses `crypto.randomUUID()` — not `Math.random()`
- [ ] Timing attack prevention: `bcrypt.compare` always runs even on missing email (see [005])
- [ ] No secrets hardcoded in source — all from `ConfigService<AppConfig>`
- [ ] R2/S3 object keys are never user-supplied filenames directly

### A03 — Injection

- [ ] No `$queryRaw` or `$executeRaw` with string interpolation — must use tagged template literals
- [ ] No dynamic `orderBy` from user input without an explicit allowlist
- [ ] File path construction never uses user input directly
- [ ] No `eval()`, `new Function()`, or dynamic code execution

### A04 — Insecure Design

- [ ] Enrollment flow checks course is PUBLISHED before allowing enrollment
- [ ] Published lessons with student progress cannot be deleted without check (409 on conflict)
- [ ] Token rotation: old refresh token deleted on every `refresh` call
- [ ] Password change invalidates all sessions (see [002])
- [ ] Account deletion: DB delete before Redis cleanup (see [012])

### A05 — Security Misconfiguration

- [ ] `helmet()` applied in `main.ts`
- [ ] CORS origin uses `config.get('cors.origins')` — never hardcoded `'*'`
- [ ] No `cors:` option on `@WebSocketGateway` decorators
- [ ] No `enableImplicitConversion: true` in `ValidationPipe` config (see [004])
- [ ] Environment variables validated by Zod on startup — no silent fallbacks for required vars

### A06 — Vulnerable and Outdated Components

- [ ] No use of deprecated `passport-jwt` config patterns
- [ ] `pnpm audit` passes at `--audit-level=high`

### A07 — Identification and Authentication Failures

- [ ] JWT strategy verifies `payload.type === 'access'` (see [011])
- [ ] WebSocket `authenticate()` verifies `payload.type === 'access'` (see [011])
- [ ] JWT strategy checks `revoked:user:${userId}` in Redis
- [ ] WebSocket `authenticate()` checks `revoked:user:${userId}` in Redis
- [ ] Login endpoint has `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] Register endpoint has `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] Refresh endpoint has `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- [ ] Failed login does NOT log the email address (see [010])

### A08 — Software and Data Integrity Failures

- [ ] No auto-update scripts without integrity checks
- [ ] Webhook endpoints (if any) verify signatures

### A09 — Security Logging and Monitoring Failures

- [ ] Login failures logged with user ID (not email), action, and IP
- [ ] Revoked token use logged with user ID and JTI
- [ ] Password changes logged with user ID
- [ ] No `console.log` in security-sensitive code paths — always `Logger`
- [ ] No PII (email, name) in error log messages

### A10 — Server-Side Request Forgery

- [ ] URL fields in DTOs validated with `@IsUrl()` — no open URL fetch from user-supplied URLs
- [ ] R2 `getSignedUrl` uses internal bucket path — never user-supplied URL

---

## LMS-specific BOLA Checklist

For every controller endpoint that operates on a nested resource:

- [ ] `GET /courses/:courseId/modules/:moduleId` — `module.courseId === courseId`
- [ ] `GET /courses/:courseId/modules/:moduleId/lessons/:lessonId` — `lesson.moduleId === moduleId` AND `lesson.module.courseId === courseId`
- [ ] `PATCH /courses/:courseId/modules/:moduleId/lessons/:lessonId` — same chain
- [ ] `DELETE /courses/:courseId/modules/:moduleId/lessons/:lessonId` — same chain
- [ ] `POST /courses/:courseId/modules/:moduleId/lessons/:lessonId/resources` — same chain
- [ ] Course owner guard: `course.instructorId === user.id` for all write operations

---

## WebSocket Security Checklist

- [ ] `handleConnection` authenticates client immediately — `client.disconnect()` on failure
- [ ] Token extracted from `handshake.auth.token` OR `Authorization` header
- [ ] `payload.type === 'access'` checked in `authenticate()`
- [ ] `revoked:user:${userId}` checked in `authenticate()`
- [ ] Every `@SubscribeMessage` uses `@MessageBody(new ValidationPipe({ whitelist: true }))` with typed DTO (see [003])
- [ ] Rate limiting implemented per-connection in every handler (see [013])
- [ ] Room names use validated IDs from typed DTOs — not raw string concatenation
- [ ] Broadcast scope: `server.to(room).emit()` — not `server.emit()` to all clients
- [ ] `enrollmentsService.isEnrolled()` called for course-scoped room access

---

## Business Logic Checklist

- [ ] Self-vote: `post.authorId !== user.id` before vote (see [008])
- [ ] Self-enrollment: `course.instructorId !== user.id` before enroll (see [008])
- [ ] Email verification: `user.isVerified === true` required before enrollment
- [ ] Double enrollment: handled via upsert or explicit conflict check
- [ ] Course deletion: requires 0 non-cancelled enrollments
- [ ] Lesson deletion: requires 0 student progress records if published
- [ ] Module visibility: publishedOnly filter applied for non-instructor/admin callers
- [ ] Forum delete: thread with replies throws 409

---

## Prisma-Specific Checklist

- [ ] No `findMany` without `take` limit
- [ ] No `keys()` Redis command — use Sets (see [006])
- [ ] All FK fields have `@@index` in schema
- [ ] Multi-step writes use `$transaction`
- [ ] No repository exports from modules — services only
- [ ] No direct `PrismaService` injection in service classes — through repository only

---

## Output format

List all findings grouped by severity:

```
## CRITICAL
[CRITICAL] src/modules/auth/auth.service.ts:53
Issue: bcrypt.compare not run when user not found — timing attack allows user enumeration
Fix: Always compare against DUMMY_HASH when user is null
MISTAKES.md ref: [005]

## HIGH
...

## MEDIUM
...

## LOW
...

## INFORMATIONAL
...
```

End with a summary table:

| Severity | Count | Files affected |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 2 | auth.service.ts, courses.service.ts |
| MEDIUM | 1 | forum.gateway.ts |
| LOW | 0 | — |
| INFORMATIONAL | 1 | enrollments.controller.ts |

**Overall risk rating:** LOW / MEDIUM / HIGH / CRITICAL

If a category has no issues, write `✅ No issues found.`
