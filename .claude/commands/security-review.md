Perform a security review of **$ARGUMENTS**.

Read the specified file(s) and analyse them for the following vulnerability categories. Report each finding with: **severity** (Critical / High / Medium / Low), **location** (file:line), **description**, and **fix**.

---

## Checklist

### 1. Authentication & Authorization
- [ ] All non-public routes protected by `JwtAuthGuard` (or equivalent)
- [ ] `@Public()` decorator only on routes that truly need no auth (login, register, health)
- [ ] Role checks use `@Roles()` guard — not manual `if (user.role !== ...)` inside handlers
- [ ] No JWT secret hardcoded or logged
- [ ] Token expiry is enforced and refresh tokens are rotated on use

### 2. Input Validation
- [ ] Every controller method that accepts a body uses a DTO with `class-validator` decorators
- [ ] `whitelist: true` and `forbidNonWhitelisted: true` are set on `ValidationPipe` (global in `main.ts`)
- [ ] No `@Body() body: any` or `@Query() query: any` without typing
- [ ] File uploads validate MIME type and size before processing
- [ ] Path parameters are validated (UUIDs use `@IsUUID()` or `ParseUUIDPipe`)

### 3. SQL Injection / Prisma Raw Queries
- [ ] No `prisma.$queryRaw` or `prisma.$executeRaw` with string interpolation
- [ ] If raw queries exist, they use tagged template literals: `prisma.$queryRaw\`SELECT ... WHERE id = ${id}\``
- [ ] No dynamic `orderBy` built from user input without an allowlist

### 4. Sensitive Data Exposure
- [ ] Passwords / hashes never returned in response DTOs
- [ ] `Response*Dto` classes explicitly exclude `passwordHash`, tokens, internal IDs where appropriate
- [ ] No sensitive values in log statements (`logger.log(user)` with full object)
- [ ] Stack traces not exposed in API responses (check `GlobalExceptionFilter`)
- [ ] No secrets in comments or hardcoded strings

### 5. Rate Limiting & DoS
- [ ] Auth endpoints (login, register, forgot-password) have stricter rate limits than the global default
- [ ] File upload endpoints have size limits configured
- [ ] No unbounded queries (`findMany` without `take` limit)

### 6. Mass Assignment
- [ ] `whitelist: true` is active globally — extra fields are stripped
- [ ] Update DTOs do not allow updating `id`, `createdAt`, `role` (unless admin-only)
- [ ] No `prisma.user.update({ data: dto })` where `dto` might contain `role` from user input

### 7. CORS & Headers
- [ ] CORS `origin` is an explicit allowlist, not `*` in production
- [ ] `helmet()` is applied in `main.ts`
- [ ] No `Access-Control-Allow-Origin: *` set manually on individual routes

### 8. Error Handling
- [ ] All async controller methods are `async`/`await` (no unhandled promise rejections)
- [ ] `@nestjs/common` HTTP exceptions used (not raw `Error` throws in controllers)
- [ ] `GlobalExceptionFilter` swallows the stack trace in non-development environments

### 9. Cryptography
- [ ] Passwords hashed with bcrypt (cost factor ≥ 10) or argon2 — never MD5/SHA1
- [ ] No custom crypto — use established libraries
- [ ] Random tokens use `crypto.randomBytes`, not `Math.random()`

### 10. WebSocket Security
- [ ] Socket.io gateways validate the JWT token in the handshake
- [ ] Room names are not built directly from user input without sanitisation
- [ ] Broadcast events do not leak data across tenants/users

---

## Output format

For each issue found:

```
[SEVERITY] file:line
Issue: <description>
Fix: <concrete recommendation>
```

At the end, provide a **summary table** of all findings and an overall risk rating (Low / Medium / High / Critical).

If no issues are found in a category, explicitly state "No issues found" for that category.
