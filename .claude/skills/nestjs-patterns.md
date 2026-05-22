# NestJS Architecture Patterns

Reference this skill when creating modules, structuring code, wiring dependencies, or deciding where logic belongs.

---

## Module creation order

Always create files in this exact order. Skipping steps causes TypeScript errors or circular dependency issues.

1. `<domain>.entity.ts` — re-export Prisma type
2. `dto/create-<domain>.dto.ts` — required fields with class-validator
3. `dto/update-<domain>.dto.ts` — always `PartialType(CreateDto)`
4. `dto/<domain>-response.dto.ts` — API shape, never includes sensitive fields
5. `<domain>.repository.ts` — all Prisma calls, returns Prisma types
6. `<domain>.service.ts` — business logic, maps entities to DTOs
7. `<domain>.controller.ts` — routing only, delegates to service
8. `<domain>.module.ts` — wires providers, exports only service
9. `<domain>.service.spec.ts` — unit tests, mocks the repository
10. Register in `app.module.ts`
11. `pnpm build` — fix all TypeScript errors

---

## Layer responsibilities

### Controllers
- HTTP routing only
- Extract params, body, user from request
- Delegate entirely to service
- Apply `ParseUUIDPipe` on UUID params
- Apply `@Roles()` on writes
- Apply `@HttpCode(204)` on deletes
- **Never:** business logic, Prisma calls, Redis calls, raw Error throws

### Services
- Business logic only
- Call their own repository — never another module's repository
- Map every Prisma entity through `private map(entity): ResponseDto`
- Throw NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, etc.)
- **Never:** HTTP concerns (`Request`/`Response` objects), direct Prisma calls, raw `Error` throws

### Repositories
- All Prisma calls for the domain
- Return Prisma types (not DTOs)
- Return `null` on not-found — never throw
- Use `Prisma.XxxCreateInput` / `Prisma.XxxUpdateInput` for writes
- **Never:** business logic, HTTP concerns, calls to other domain's repositories

---

## Guard placement

```typescript
// ✅ Write endpoint — role guard required
@Post()
@Roles('INSTRUCTOR', 'ADMIN')
create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDto): Promise<ResponseDto>

// ✅ Public endpoint — explicit opt-out
@Get()
@Public()
findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<ResponseDto>>

// ✅ Protected resource with ownership check — method guard
@Patch(':id')
@Roles('INSTRUCTOR', 'ADMIN')
@UseGuards(CourseOwnerGuard)
update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDto): Promise<ResponseDto>
```

`CourseOwnerGuard` and similar domain guards must verify BOTH role AND the resource ownership chain. Never just check role alone for owner-scoped operations.

---

## Static routes before parameterized routes

NestJS matches routes in declaration order. Declare static segments before `/:id` patterns:

```typescript
// ✅ Correct order
@Get('me')         // matches /users/me
findMe(): ...

@Get('reorder')    // matches /lessons/reorder
reorder(): ...

@Get(':id')        // matches /users/:id
findOne(): ...

// ❌ Wrong — :id swallows 'me' and 'reorder'
@Get(':id')
findOne(): ...

@Get('me')
findMe(): ...
```

---

## PartialType — always for update DTOs

```typescript
// ✅ Correct — inherits all decorators and @ApiProperty from CreateDto
import { PartialType } from '@nestjs/swagger';  // NOT from @nestjs/mapped-types
import { CreateCourseDto } from './create-course.dto';
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

// ❌ Wrong — copy-pasted with all-optional fields loses decorators
export class UpdateCourseDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
}
```

Always import `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) to preserve Swagger decorator inheritance.

---

## Cross-module dependencies

Module B needs data from Module A: import Module A, inject Service A. Never inject Repository A.

```typescript
// ✅ Correct
@Module({
  imports: [CoursesModule],
  providers: [EnrollmentsService, EnrollmentsRepository],
})
export class EnrollmentsModule {}

// In EnrollmentsService
constructor(
  private readonly enrollmentsRepository: EnrollmentsRepository,
  private readonly coursesService: CoursesService,
) {}

// ❌ Wrong — never inject another module's repository
constructor(private readonly coursesRepository: CoursesRepository) {}
```

---

## Global vs domain modules

| Module | Access pattern | Why |
|---|---|---|
| `PrismaModule` | `@Global()` — inject anywhere | App-wide infrastructure |
| `RedisModule` | `@Global()` — inject anywhere | App-wide infrastructure |
| `StorageModule` | Import explicitly in each module that needs it | Domain concern |
| Feature modules | Import explicitly | Enforce boundaries |

---

## WebSocket gateway wiring

Gateways that need JWT must have `JwtModule.register({})` in their module:

```typescript
@Module({
  imports: [JwtModule.register({}), CoursesModule, EnrollmentsModule],
  providers: [ForumGateway, ForumService, ForumRepository],
  exports: [ForumService],
})
export class ForumModule {}
```

Never put `cors:` option on `@WebSocketGateway`. CORS is handled globally by `SocketIoCorsAdapter` in `main.ts`.

---

## ResponseInterceptor — skip on 204

`ResponseInterceptor` wraps responses in `{ data, timestamp }`. It must skip wrapping when the status is 204 (DELETE returns no body). Verify:

```typescript
// In response.interceptor.ts
intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
  return next.handle().pipe(
    map((data) => {
      const res = context.switchToHttp().getResponse<Response>();
      if (res.statusCode === 204) return data; // skip wrapping
      return { data, timestamp: new Date().toISOString() };
    }),
  );
}
```

---

## Logging — always use NestJS Logger

```typescript
// ✅ Correct
private readonly logger = new Logger(CoursesService.name);
this.logger.warn(`Course not found: ${id}`);
this.logger.log(`Course created: ${course.id} by user ${userId}`);

// ❌ Wrong — never
console.log('Course created:', course);
```

Always include `userId` and `requestId` in security-relevant log lines. Never log full entity objects (they may contain sensitive fields).

---

## Common mistakes to avoid

| Mistake | Consequence | Fix |
|---|---|---|
| `@IsString()` on UUID field | Accepts any garbage string | `@IsUUID()` |
| Bare `@Param('id') id: string` | No 400 on bad input | `@Param('id', ParseUUIDPipe) id: string` |
| Service injects `PrismaService` | Breaks testability | Inject domain repository |
| Raw Prisma object returned | Exposes `passwordHash` etc | Map through `private map()` |
| `protected readonly` on active service | Suppresses TS6138 | Change to `private readonly` |
| Missing `@HttpCode(204)` on DELETE | Returns 200 with `{ data: null }` | Add `@HttpCode(HttpStatus.NO_CONTENT)` |
| Unbounded `findMany` | DoS on large tables | Add `take` from pagination |
| Exporting repository from module | Bypasses service layer | Export only service |
| `cors:` on `@WebSocketGateway` | Ignored, confusing | Remove; configure in `main.ts` |
| No `@Throttle()` on auth endpoints | Brute-force possible | `@Throttle({ default: { limit: 5, ttl: 60000 } })` |
