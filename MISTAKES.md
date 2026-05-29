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

---

## [015] R2 uploads served inline — PDF embedded-JS attack vector
**Date:** 2026-05
**Category:** Stored XSS / Content Injection
**What happened:** `StorageService.upload()` and `getPresignedUploadUrl()` passed the caller-supplied MIME type directly as `ContentType` in `PutObjectCommand` with no `ContentDisposition` header. Files in the `submissions/` path (assignment uploads) were therefore served inline by R2. PDF engines (Adobe Reader, Chrome's built-in viewer) can execute JavaScript embedded in PDFs, so a malicious PDF uploaded as an assignment submission became executable in the browser of any user who opened its CDN URL.
**Fix:** Added a private `isSubmissionKey()` check in `StorageService`. For any key under `submissions/`, both `upload()` and `getPresignedUploadUrl()` now force `ContentType: 'application/octet-stream'` and `ContentDisposition: 'attachment'`. Avatar and course-cover images keep their real MIME types — inline serving is correct and expected for those paths.
**Rule:** Always set `ContentDisposition: 'attachment'` and `ContentType: 'application/octet-stream'` on R2/S3 objects written by users. Inline serving is only safe for assets you control entirely (avatars, thumbnails). Magic-bytes MIME validation blocks HTML uploads but does not protect against PDFs or other formats that browsers can render and that support active content.

---

## [016] POST /auth/oauth trusts frontend to validate OAuth tokens
**Date:** 2026-05
**Category:** Authentication / Insufficient Token Verification
**What happened:** The `POST /auth/oauth` endpoint accepts `provider`, `providerAccountId`, and `email` from the frontend body after Auth.js has validated the OAuth flow client-side. The backend does not independently verify the OAuth ID token with Google or Microsoft APIs. A compromised frontend — or a direct API call — could pass any email and create or log in as any user, since the backend performs no cryptographic verification of the claimed identity.
**Fix (future):** Pass the raw OAuth `id_token` (Google) or `access_token` (Microsoft) in the request body and verify it server-side before trusting any claims:
- Google: `GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>` → extract `email` from the verified payload
- Microsoft: `GET https://graph.microsoft.com/oidc/userinfo` with `Authorization: Bearer <token>` → extract `email`
Never derive `email` from the frontend payload — derive it from the server-verified token response.
**Accepted risk (current):** The frontend uses Auth.js v5 which validates tokens with the provider before calling this endpoint. The endpoint is also rate-limited (5 req/min). This is acceptable for the current phase but must be fixed before the platform handles sensitive data or payments.
**Rule:** Never trust user identity claims from the frontend after an OAuth flow. Verify the OAuth token server-side with the issuing provider and extract identity (email, sub) from the verified response.

---

## [014] Role check instead of ownership check on new resource modules
**Date:** 2026-05
**Category:** Broken Object Level Authorization
**What happened:** New modules (gradebook, rubrics, calendar, groups) used `user.roles.includes(UserRole.INSTRUCTOR)` as their access gate, which only proves the user _can_ teach — not that they own _this specific course_. An instructor from Course A could read grades for Course B students, write rubric assessments on Course B submissions, and inject calendar events into Course B.
**Fix:**
```typescript
// ✅ Correct — ownership, not role
const course = await this.coursesService.findOne(courseId, user);
if (!user.roles.includes(UserRole.ADMIN) && course.instructorId !== user.id) {
  throw new ForbiddenException('You do not own this course');
}

// ❌ Wrong — role proves nothing about which course
if (!user.roles.includes(UserRole.INSTRUCTOR)) {
  throw new ForbiddenException('...');
}
```
**Rule:** `INSTRUCTOR` role only proves the user can teach. It does NOT prove they own this specific resource. Always verify `resource.ownerId === user.id || user.roles.includes(ADMIN)` before any write or sensitive read. Never use role alone as a substitute for resource ownership.
