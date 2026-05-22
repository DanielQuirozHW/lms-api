⚠️ Claude MUST read this file before generating any code in this project.

# Known Mistakes — LMS API Security Audit Log

This file records real mistakes found during security audits. Every entry is a pattern that has already occurred in this codebase. Read before writing any service, controller, guard, or DTO.

---

## [001] BOLA — Resource not scoped to parent chain in write operations
**Date:** 2026-05
**Category:** Broken Object Level Authorization
**What happened:** `courseId` from the URL was not validated against the `moduleId` or `lessonId` being written. An attacker could supply a valid `lessonId` from a different course and mutate it.
**Fix:** Always scope resource lookups to the full parent chain:
```typescript
// ✅ Correct
const lesson = await repo.findFirst({ where: { id: lessonId, moduleId, module: { courseId } } });
if (!lesson) throw new NotFoundException('Lesson not found');

// ❌ Wrong — only checks lesson exists, not that it belongs to this course
const lesson = await repo.findUnique({ where: { id: lessonId } });
```
**Rule:** Every write operation must verify the complete ownership chain, not just the top-level resource. Hierarchy: lesson → module → course → instructor.

---

## [002] Session not invalidated on password change
**Date:** 2026-05
**Category:** Broken Authentication
**What happened:** After a password change, all existing refresh tokens remained valid. An attacker who had stolen a refresh token retained access indefinitely.
**Fix:** After `bcrypt.hash` update:
1. `SMEMBERS rt-set:${userId}` to get all active JTIs
2. `DEL rt:${userId}:${jti}` for each + `DEL rt-set:${userId}`
3. `SET revoked:user:${userId} 1 EX <access_token_ttl>` to invalidate in-flight access tokens
**Rule:** Any credential change must invalidate all active sessions (both refresh and access tokens).

---

## [003] WebSocket @SubscribeMessage had no payload validation
**Date:** 2026-05
**Category:** Input Validation
**What happened:** `@MessageBody() payload: any` was used in gateway handlers. Any JSON object was accepted and passed to business logic without validation.
**Fix:**
```typescript
// ✅ Correct
@SubscribeMessage('joinThread')
async handleJoinThread(
  @ConnectedSocket() client: Socket,
  @MessageBody(new ValidationPipe({ whitelist: true })) payload: JoinThreadWsDto,
): Promise<void>

// ❌ Wrong
@SubscribeMessage('joinThread')
async handleJoinThread(@MessageBody() payload: any): Promise<void>
```
**Rule:** WebSocket payloads are never trusted, same as HTTP bodies. Always use `@MessageBody(new ValidationPipe({ whitelist: true }))` with a typed DTO.

---

## [004] enableImplicitConversion silently coerced invalid inputs
**Date:** 2026-05
**Category:** Input Validation
**What happened:** `enableImplicitConversion: true` in `ValidationPipe` config silently coerced strings like `"true"` to booleans and `"42"` to numbers, masking type mismatches.
**Fix:** Removed `enableImplicitConversion` from the global `ValidationPipe` config in `main.ts`. Use explicit `@Transform` decorators when type coercion is intentional.
**Rule:** Never use `enableImplicitConversion`. Always use explicit `@Transform` decorators.

---

## [005] JWT_EXPIRES_IN env var declared but never read — hardcoded value used
**Date:** 2026-05
**Category:** Configuration / Dead Code
**What happened:** `JWT_EXPIRES_IN` was defined in `.env.example` and validated by Zod, but `auth.service.ts` hardcoded `'15m'` as the expiry, ignoring the config value.
**Fix:** Wired `config.get('jwt.expiresIn', { infer: true }) ?? '15m'` in `signAccess()`.
**Rule:** Every env var declared in `.env.example` must be actually used in code. After adding an env var, grep for it in source to verify it is consumed.

---

## [006] Redis KEYS pattern — O(N) blocks the server
**Date:** 2026-05
**Category:** Performance / Security
**What happened:** `redisService.keys('rt:${userId}:*')` was used to find all refresh tokens for a user. On a large Redis instance, `KEYS` is O(N) and blocks the server for all operations.
**Fix:** Maintain a Redis Set per user:
- On token creation: `SADD rt-set:${userId} ${jti}`
- On token deletion: `SREM rt-set:${userId} ${jti}`
- To list all tokens: `SMEMBERS rt-set:${userId}`
**Rule:** Never use `redisService.keys()` in production code. Use Sets, Sorted Sets, or explicit key naming.

---

## [007] GET /courses/:id returned DRAFT/ARCHIVED courses to public
**Date:** 2026-05
**Category:** Sensitive Data Exposure / Broken Access Control
**What happened:** Any authenticated user could fetch a course in DRAFT status by its ID, exposing unpublished content.
**Fix:** In `CoursesService.findOne`, if the course is not PUBLISHED and the caller is not the owner or admin → throw `NotFoundException` (not `ForbiddenException` — don't confirm the resource exists).
**Rule:** Always check resource visibility against caller's role. Use 404 (not 403) when hiding a resource's existence from unauthorized viewers.

---

## [008] Self-voting and self-enrollment allowed
**Date:** 2026-05
**Category:** Business Logic / Broken Access Control
**What happened:** Users could upvote their own forum posts and enroll themselves as instructors in their own courses.
**Fix:**
```typescript
// Self-vote check
if (post.authorId === user.id) throw new BadRequestException('You cannot vote on your own post');

// Self-enrollment check
const course = await coursesService.findOne(courseId);
if (course.instructorId === user.id) throw new ForbiddenException('Instructors cannot enroll in their own course');
```
**Rule:** Always check `resource.ownerId !== currentUser.id` before allowing vote/rate/review/enrollment operations.

---

## [009] request.url used in error responses — exposes query strings
**Date:** 2026-05
**Category:** Sensitive Data Exposure
**What happened:** `GlobalExceptionFilter` used `request.url` in error responses. Query strings (e.g., `?token=xxx&email=yyy`) were logged and returned to clients.
**Fix:** Use `request.path` instead of `request.url` in `GlobalExceptionFilter`.
**Rule:** Never use `request.url` in error responses or logs. Query params may contain tokens, passwords, or PII.

---

## [010] Email address logged on failed login attempts
**Date:** 2026-05
**Category:** Sensitive Data / PII Exposure
**What happened:** `logger.warn('Login failed for email: ' + dto.email)` was logged, creating a PII audit trail.
**Fix:** Log only non-identifying info: `'Login failed — unknown email'` or `'Login failed — wrong password for user ' + user.id`.
**Rule:** Never log user-supplied identifiers (email, username) in auth failure messages. Log user IDs only after lookup confirms existence.

---

## [011] JWT strategy did not verify token type claim
**Date:** 2026-05
**Category:** Broken Authentication
**What happened:** A refresh token (type: `'refresh'`) could be used as a Bearer token on protected endpoints, since the strategy only verified signature and expiry.
**Fix:** In `JwtStrategy.validate()`:
```typescript
if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
```
Also check in WebSocket `authenticate()` method.
**Rule:** Always verify `payload.type === 'access'` in JWT strategy and WebSocket `authenticate()`. Access and refresh tokens have different secrets and claims.

---

## [012] Non-atomic account deletion — Redis cleanup before DB delete
**Date:** 2026-05
**Category:** Race Condition / Data Integrity
**What happened:** `deleteAccount` cleaned up Redis tokens first, then deleted the DB record. If the DB delete failed, the user would have no sessions but still exist in the database.
**Fix:** Always perform DB operations before cache/Redis operations:
```typescript
// ✅ Correct order
await usersRepository.delete(userId);   // DB first
await redisService.del(...rtKeys);       // Redis after
```
**Rule:** Always do database operations before cache/Redis operations in deletion flows. DB is source of truth; cache is derived state.

---

## [013] WebSocket gateways had no rate limiting
**Date:** 2026-05
**Category:** Denial of Service
**What happened:** `ThrottlerGuard` is HTTP-only. WS event handlers could be spammed without any throttling, allowing message flooding.
**Fix:** Implement per-connection token bucket rate limiting in the gateway:
```typescript
private checkRateLimit(client: Socket): boolean {
  const now = Date.now();
  const data = client.data as Record<string, unknown>;
  const windowStart = (data['rl_window'] as number | undefined) ?? now;
  const count = (data['rl_count'] as number | undefined) ?? 0;
  if (now - windowStart > WS_RATE_WINDOW_MS) {
    data['rl_window'] = now; data['rl_count'] = 1; return true;
  }
  if (count >= WS_RATE_LIMIT) return false;
  data['rl_count'] = count + 1; return true;
}
```
**Rule:** Always implement manual rate limiting in WebSocket event handlers. ThrottlerGuard does NOT apply to WebSocket events.
