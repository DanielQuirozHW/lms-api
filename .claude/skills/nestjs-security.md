# NestJS Security Rules

Reference this skill when implementing guards, auth flows, JWT handling, WebSocket gateways, or any endpoint that touches user identity or resource ownership.

---

## Guard execution order

The global guard chain is always: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → method-level guards (e.g., `CourseOwnerGuard`).

**Never change this order.** ThrottlerGuard must be first to block brute-force before any token parsing. JwtAuthGuard must run before RolesGuard because RolesGuard depends on `req.user`. This order is set in `app.module.ts` via `APP_GUARD` multi-providers — do not override per-controller.

---

## WebSocket payload validation

Every `@SubscribeMessage` handler must validate its payload. `ThrottlerGuard` does NOT apply to WebSocket events.

```typescript
// ✅ Correct — always
@SubscribeMessage('joinThread')
async handleJoinThread(
  @ConnectedSocket() client: Socket,
  @MessageBody(new ValidationPipe({ whitelist: true })) payload: JoinThreadWsDto,
): Promise<void>

// ❌ Wrong — never
@SubscribeMessage('joinThread')
async handleJoinThread(@MessageBody() payload: any): Promise<void>
```

---

## UUID path parameters

Every UUID path param must use `ParseUUIDPipe`. No exceptions.

```typescript
// ✅ Correct
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseDto>

// ❌ Wrong — accepts garbage strings, no 400 response
@Get(':id')
findOne(@Param('id') id: string): Promise<ResponseDto>
```

---

## Hierarchy ownership — always verify the full chain

When a resource is nested (lesson inside module inside course), every read and write must verify the complete ownership chain up to the top-level resource that the caller owns.

```typescript
// ✅ Correct — full chain verified
const lesson = await repo.findFirst({
  where: { id: lessonId, moduleId, module: { courseId } },
});
if (!lesson) throw new NotFoundException('Lesson not found');

// ❌ Wrong — only verifies lesson exists
const lesson = await repo.findUnique({ where: { id: lessonId } });
if (!lesson) throw new NotFoundException('Lesson not found');
// attacker can pass a lessonId from a different course
```

Chain: `lesson.moduleId === moduleId` AND `lesson.module.courseId === courseId` AND `course.instructorId === user.id`.

---

## JWT — token type verification

Always verify `payload.type === 'access'` in `JwtStrategy.validate()` and in every WebSocket `authenticate()` method. Refresh tokens have `type: 'refresh'` and must never be accepted as Bearer tokens.

```typescript
// JwtStrategy.validate()
async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
  if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
  const revoked = await this.redisService.get(`revoked:user:${payload.sub}`);
  if (revoked) throw new UnauthorizedException('Token revoked');
  return { id: payload.sub, email: payload.email, roles: payload.roles, isVerified: payload.isVerified };
}
```

---

## JWT — revocation check

Every JWT validation point (strategy + WebSocket authenticate) must check `revoked:user:${userId}` in Redis. This key is set on password change and account deletion to invalidate in-flight access tokens before they expire naturally.

```typescript
const revoked = await this.redisService.get(`revoked:user:${payload.sub}`);
if (revoked) throw new UnauthorizedException('Token revoked');
```

---

## WebSocket — manual rate limiting

`ThrottlerGuard` is HTTP-only. Every WebSocket gateway must implement a per-connection token bucket. Call `checkRateLimit(client)` at the top of every `@SubscribeMessage` handler:

```typescript
const WS_RATE_LIMIT = 20;
const WS_RATE_WINDOW_MS = 10_000;

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

---

## Sensitive field exposure

Never include in any response DTO:
- `passwordHash`
- `roles` (in public/unauthenticated DTOs)
- Raw internal IDs that expose implementation details
- Internal error messages or stack traces

Services must always map through a `private map(entity): ResponseDto` method. Never `return rawPrismaObject`.

---

## Prisma error mapping (automatic via GlobalExceptionFilter)

| Prisma code | HTTP status | Exception |
|---|---|---|
| P2002 | 409 Conflict | Unique constraint violated |
| P2025 | 404 Not Found | Record not found (from Prisma) |
| P2003 | 400 Bad Request | Foreign key constraint |

Do not re-implement these mappings in services. Let Prisma errors bubble to `GlobalExceptionFilter`.

---

## Resource scoping — every findById must include parent

```typescript
// ✅ Correct — lesson scoped to module and course
findByIdWithModule(id: string): Promise<(Lesson & { module: { courseId: string } }) | null> {
  return this.prisma.lesson.findUnique({
    where: { id },
    include: { module: { select: { courseId: true } } },
  });
}

// ❌ Wrong — no parent scope
findById(id: string): Promise<Lesson | null> {
  return this.prisma.lesson.findUnique({ where: { id } });
}
```

---

## Redis session tracking — never use KEYS

```typescript
// ✅ Correct — O(1) per-user set
await redisService.sadd(`rt-set:${userId}`, jti);          // on issue
await redisService.srem(`rt-set:${userId}`, jti);          // on revoke
const jtis = await redisService.smembers(`rt-set:${userId}`); // on password change

// ❌ Wrong — O(N) blocks Redis
const keys = await redisService.keys(`rt:${userId}:*`);
```

---

## Timing attack prevention

Always run `bcrypt.compare` even when the user is not found. Use a precomputed dummy hash to ensure constant-time response:

```typescript
const DUMMY_HASH = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
```

---

## Self-operation prevention

Before allowing vote, rate, review, or enroll, always verify the user is not acting on their own resource:

```typescript
if (post.authorId === user.id) throw new BadRequestException('You cannot vote on your own post');
if (course.instructorId === user.id) throw new ForbiddenException('Instructors cannot enroll in their own course');
```
