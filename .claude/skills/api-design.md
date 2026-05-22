# REST API Design Conventions

Reference this skill when designing new endpoints, choosing HTTP status codes, structuring paginated responses, or writing Swagger documentation.

---

## Response envelope — all non-204 responses

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
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

DELETE responses return HTTP 204 with no body. `ResponseInterceptor` skips wrapping on 204.

---

## HTTP status codes

| Operation | Status | Notes |
|---|---|---|
| GET (found) | 200 | |
| POST (created) | 201 | `@HttpCode(HttpStatus.CREATED)` is default for POST |
| PATCH / PUT (updated) | 200 | |
| DELETE | 204 | `@HttpCode(HttpStatus.NO_CONTENT)` required |
| Validation failed | 400 | Automatic via `ValidationPipe` |
| Unauthenticated | 401 | No token or invalid token |
| Forbidden | 403 | Valid token, wrong role or ownership |
| Not found | 404 | Resource missing — also use for hidden resources (see below) |
| Conflict | 409 | Duplicate unique field, P2002 |
| Business rule violation | 422 | e.g., enrollment when already enrolled |
| Rate limited | 429 | Automatic via `ThrottlerGuard` |

**404 vs 403 for hidden resources:** When hiding a resource's existence from unauthorized viewers (e.g., DRAFT course), always return 404 — not 403. Returning 403 confirms the resource exists.

---

## Pagination

All list endpoints must accept `PaginationDto` and return `PaginatedResult<T>`:

```typescript
// ✅ Every list endpoint
@Get()
findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<CourseResponseDto>> {
  return this.coursesService.findAll(pagination);
}
```

`PaginationDto` provides `page`, `limit`, `skip`. Default limit: 20. Max limit: 100.

---

## Error format

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

`path` must use `request.path` (never `request.url` — query strings may contain tokens).

---

## DTO field exposure — whitelist principle

Never return more fields than the DTO defines. `ValidationPipe` with `whitelist: true` strips unknown fields on input. Services must explicitly map entities to response DTOs to control output.

Public endpoints must return only non-sensitive fields. Even for authenticated endpoints, `passwordHash`, internal state, and FK IDs not needed by the client should be excluded.

---

## Public endpoints

Explicitly mark public endpoints with `@Public()`:

```typescript
@Get()
@Public()
findAll(): Promise<...>
```

Public endpoint response DTOs must not include: `passwordHash`, `roles` (full role list), private email, or any admin-only fields. Create a separate `PublicCourseResponseDto` if necessary.

---

## Swagger documentation — required on all endpoints

```typescript
@ApiTags('Courses')
@Controller('courses')
@ApiBearerAuth()  // on controllers with protected endpoints
export class CoursesController {

  @Get()
  @Public()
  @ApiOperation({ summary: 'List published courses' })
  @ApiResponse({ status: 200, type: PaginatedCoursesResponseDto })
  findAll(): Promise<...>

  @Post()
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new course (instructor/admin)' })
  @ApiResponse({ status: 201, type: CourseResponseDto })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(): Promise<...>
}
```

Every endpoint needs `@ApiOperation` + at least one `@ApiResponse`. Response DTOs need `@ApiProperty()` on every field.

---

## Naming conventions

| Context | Convention | Example |
|---|---|---|
| Variables, parameters | camelCase | `courseId`, `enrolledAt` |
| Classes, types, enums | PascalCase | `CourseResponseDto`, `UserRole` |
| Constants | UPPER_SNAKE_CASE | `BCRYPT_ROUNDS`, `MAX_LIMIT` |
| File names | kebab-case | `course-response.dto.ts` |
| URL paths | kebab-case | `/api/v1/course-modules` |
| Database columns | snake_case via `@map` | `created_at` |
| Prisma relation names | camelCase | `courseModules` |
| Enum values | UPPER_SNAKE_CASE | `DRAFT`, `IN_PROGRESS` |

---

## URL structure

```
/api/v1/{resource}                    GET list, POST create
/api/v1/{resource}/{id}               GET one, PATCH update, DELETE remove
/api/v1/{resource}/{id}/{sub}         GET sub-list, POST sub-create
/api/v1/{resource}/{id}/{sub}/{subId} GET sub-one, PATCH/DELETE sub-resource
/api/v1/{resource}/{id}/actions/{action}  POST for state transitions (publish, cancel)
```

Examples:
- `GET /api/v1/courses` — list courses
- `POST /api/v1/courses/:courseId/modules` — create module in course
- `POST /api/v1/courses/:courseId/modules/:moduleId/lessons/:lessonId/publish` — publish lesson
