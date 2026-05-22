# Error Handling Patterns

Reference this skill when writing exception handling, logging, filters, or any code that deals with failure states.

---

## Single error boundary — GlobalExceptionFilter

`GlobalExceptionFilter` in `src/common/filters/http-exception.filter.ts` is the single place where exceptions are caught, mapped, and shaped into responses.

**Never:**
- Catch and re-throw with `throw new InternalServerErrorException(originalError.message)`
- Return stack traces to clients
- Catch `AppException` in controllers
- Use `try/catch` in controllers for normal application errors

**Do:**
- Throw NestJS HTTP exceptions from services (`NotFoundException`, `ConflictException`, etc.)
- Let Prisma P2002/P2025/P2003 bubble up to the filter
- Only use `try/catch` in services when you need to handle a specific known error and transform it

---

## Prisma error mapping — automatic

`GlobalExceptionFilter` handles these automatically. Do not re-implement:

| Prisma code | Meaning | HTTP status |
|---|---|---|
| P2002 | Unique constraint violation | 409 Conflict |
| P2025 | Record not found (from Prisma delete/update) | 404 Not Found |
| P2003 | Foreign key constraint violation | 400 Bad Request |

```typescript
// ✅ Correct — let P2002 bubble up, filter turns it into 409
async create(data: Prisma.CourseCreateInput): Promise<CourseResponseDto> {
  const course = await this.repo.create(data);
  return this.map(course);
}

// ❌ Wrong — unnecessary catch
async create(data: Prisma.CourseCreateInput): Promise<CourseResponseDto> {
  try {
    const course = await this.repo.create(data);
    return this.map(course);
  } catch (e) {
    if (e.code === 'P2002') throw new ConflictException('Slug already taken');
    throw e;
  }
}
```

---

## Error response format

All errors return:
```json
{
  "statusCode": 404,
  "message": "Course not found",
  "error": "Not Found",
  "path": "/api/v1/courses/abc123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

`path` field: always `request.path` — never `request.url`. Query strings in URLs may contain tokens, PII, or API keys.

---

## Never return stack traces or internal details

```typescript
// ✅ Correct — filter logs the error, returns only message
catch(exception: unknown, host: ArgumentsHost): void {
  this.logger.error('Unhandled exception', { error: exception });
  response.status(status).json({ statusCode: status, message: safeMessage });
}

// ❌ Wrong — exposes internal implementation
response.status(500).json({ message: exception.message, stack: exception.stack });
```

In non-development environments, `GlobalExceptionFilter` must return only the HTTP status message for unhandled errors (never `exception.message`).

---

## Logging — what to log vs what to omit

**Always log in security events:**
- Login failure (log user ID if found, not email): `Login failed — wrong password for user ${user.id}`
- Revoked token used: `Revoked refresh token used — user ${userId}, jti ${jti}`
- Forbidden access attempts: `Forbidden: user ${userId} attempted to access course ${courseId}`
- Password changes: `Password changed — all sessions revoked for user ${userId}`
- Account deletion: `Account deleted for user ${userId}`

**Never log:**
- Passwords (plaintext or hashed)
- JWT tokens (access or refresh)
- Email addresses in auth failure messages (user enumeration)
- Full user objects (may contain sensitive fields)
- R2/S3 signed URLs (contain auth credentials)
- Query strings (may contain tokens)

**Log format:**
```typescript
this.logger.warn(`Login failed — wrong password for user ${user.id}`, {
  userId: user.id,
  action: 'login',
  ip: request.ip,
});
```

Always include `userId` (from JWT if available), action name, and request context.

---

## Logout and token invalidation — swallow expected errors

Token-invalidation paths must not throw on expired tokens (expected behavior):

```typescript
// ✅ Correct — expired token is not an error in logout context
async logout(userId: string, refreshToken: string): Promise<void> {
  try {
    const payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken, { secret });
    if (payload.sub === userId) {
      await this.redisService.del(this.rtKey(userId, payload.jti));
    }
  } catch {
    // Token already expired or invalid — nothing to revoke, silently succeed
  }
}
```

---

## Exception selection guide

| Situation | Exception |
|---|---|
| Resource not found | `NotFoundException('X not found')` |
| Duplicate unique field | `ConflictException('X already exists')` — or let P2002 bubble |
| Invalid input / business rule | `BadRequestException('...')` |
| User not authenticated | `UnauthorizedException('...')` |
| Valid token, wrong role/ownership | `ForbiddenException('...')` |
| Business rule violation (enrolled, published) | `ConflictException` or `UnprocessableEntityException` |
| Resource exists but hidden | `NotFoundException` (not `ForbiddenException` — don't leak existence) |

---

## X-Request-ID header

Every response should include an `X-Request-ID` header for tracing. Generate it in the `LoggingInterceptor` if not already present in the request:

```typescript
const requestId = req.headers['x-request-id'] as string | undefined ?? randomUUID();
res.setHeader('X-Request-ID', requestId);
```

Include `requestId` in all structured log entries.
