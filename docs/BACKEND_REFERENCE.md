# LMS API — Backend Reference

> **Audience**: Frontend developers. This document is the single source of truth for all API endpoints, request/response shapes, authentication, and real-time events. You should not need to read the backend source code after reading this document.

---

## Table of Contents

1. [Stack & Base URL](#1-stack--base-url)
2. [Authentication](#2-authentication)
3. [Response Format](#3-response-format)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Rate Limiting](#5-rate-limiting)
6. [Endpoint Reference](#6-endpoint-reference)
   - [Health](#health)
   - [Auth](#auth)
   - [Users](#users)
   - [Categories](#categories)
   - [Courses](#courses)
   - [Course Modules](#course-modules)
   - [Lessons](#lessons)
   - [Enrollments](#enrollments)
   - [Quiz](#quiz)
   - [Assignments](#assignments)
   - [Rubrics](#rubrics)
   - [Gradebook](#gradebook)
   - [Groups](#groups)
   - [Forum](#forum)
   - [Messages](#messages)
   - [Notifications](#notifications)
   - [Ratings](#ratings)
   - [Announcements](#announcements)
   - [Calendar](#calendar)
   - [Upload](#upload)
   - [Admin](#admin)
   - [Maintenance](#maintenance)
   - [Global Announcements](#global-announcements)
   - [Enrollment Codes](#enrollment-codes)
   - [Bulk Enrollment](#bulk-enrollment)
   - [User Assignments](#user-assignments)
   - [Lesson Notes](#lesson-notes)
   - [Bookmarks](#bookmarks)
   - [Certificates](#certificates)
7. [WebSocket Events](#7-websocket-events)
8. [File Uploads](#8-file-uploads)
9. [Data Models](#9-data-models)
10. [Security Notes for Frontend](#10-security-notes-for-frontend)

---

## 1. Stack & Base URL

| Item | Value |
|------|-------|
| Framework | NestJS 11 (TypeScript strict) |
| Database | PostgreSQL 16 via Prisma 7 |
| Cache / Sessions | Redis 7 |
| File Storage | Cloudflare R2 (S3-compatible) |
| Real-time | Socket.io |
| Local base URL | `http://localhost:3000/api/v1` |
| Production base URL | Configured via `CORS_ORIGINS` env var |
| API prefix | `api/v1` (all REST endpoints) |
| Swagger UI | `GET /api/docs` (enabled in development only) |
| Body size limit | 256 KB (JSON / URL-encoded) |
| Allowed methods | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| Allowed headers | `Content-Type`, `Authorization`, `X-Request-ID` |

---

## 2. Authentication

### Overview

The API uses **JWT Bearer tokens**. Every protected endpoint requires:

```
Authorization: Bearer <accessToken>
```

### Token Lifecycle

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access token | 15 minutes | Redis (revocation tracking) |
| Refresh token | 7 days | Redis (revocation tracking) |

- Access tokens are **short-lived**. Refresh before expiry using `POST /api/v1/auth/refresh`.
- Refresh tokens are **single-use** (rotation on refresh). The old token is revoked immediately.
- On logout, both the refresh token and the access token's session are revoked in Redis.

### Token Flow

```
1. POST /api/v1/auth/register  →  { accessToken, refreshToken, user }
   POST /api/v1/auth/login     →  { accessToken, refreshToken, user }

2. Include on every protected request:
   Authorization: Bearer <accessToken>

3. When access token expires (401):
   POST /api/v1/auth/refresh  →  { accessToken, refreshToken, user }
   (send the current refreshToken in request body)

4. On logout:
   POST /api/v1/auth/logout  (send refreshToken in body)
```

### Token Storage Recommendation

Store tokens in **memory** (not `localStorage`) when security is critical. If persistence across page reloads is required, use `sessionStorage`. Never store in a non-`HttpOnly` cookie if XSS is a concern.

### Public Endpoints

Endpoints marked `@Public` do not require an `Authorization` header. All other endpoints require it.

---

## 3. Response Format

### Success Response Envelope

All successful responses (except 204 No Content) are wrapped:

```json
{
  "data": <payload>,
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

A paginated payload looks like:

```json
{
  "data": {
    "data": [ ...items ],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  },
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

**Pagination query parameters** (available on all paginated endpoints):

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | `1` | — | Page number (1-based) |
| `limit` | integer | `20` | `100` | Items per page |

### Error Response Envelope

```json
{
  "statusCode": 404,
  "message": "Course not found",
  "error": "Not Found",
  "path": "/api/v1/courses/abc123",
  "timestamp": "2026-05-24T10:30:00.000Z"
}
```

### HTTP Status Code Reference

| Scenario | Code |
|----------|------|
| GET — found | 200 |
| POST — created | 201 |
| PATCH/PUT — updated | 200 |
| DELETE — deleted | 204 (no body) |
| Validation failed | 400 |
| Not authenticated | 401 |
| Forbidden (wrong role or ownership) | 403 |
| Not found | 404 |
| Conflict (duplicate, full, etc.) | 409 |
| Rate limited | 429 |
| All services down | 503 |

---

## 4. User Roles & Permissions

### Roles

| Role | Description |
|------|-------------|
| `STUDENT` | Default role for new accounts. Can enroll, learn, participate in forums, send messages. |
| `INSTRUCTOR` | Can create and manage courses, modules, lessons, quizzes, assignments, rubrics, gradebook, groups, and announcements for their own courses. |
| `ADMIN` | Full access to all resources. Can manage any course, cancel any enrollment, and perform administrative operations. |

Users have a `roles` **array** — a user can hold multiple roles simultaneously.

### Capability Summary

| Action | STUDENT | INSTRUCTOR | ADMIN |
|--------|---------|------------|-------|
| Register / login | Yes | Yes | Yes |
| Enroll in courses | Yes | No (self-enrollment blocked) | No (direct DB only) |
| View published courses/lessons | Yes | Yes | Yes |
| View own enrollment progress | Yes | Yes (for own courses) | Yes |
| Create/edit courses | No | Yes (own only) | Yes (any) |
| Publish/archive courses | No | Yes (own only) | Yes (any) |
| Create modules/lessons | No | Yes (own courses only) | Yes (any) |
| Manage quiz/assignment settings | No | Yes (own courses only) | Yes (any) |
| Grade submissions | No | Yes (own courses only) | Yes (any) |
| Create announcements | No | Yes (own courses only) | Yes (any) |
| Manage categories | No | No | Yes |
| View all users | No | No | Yes |
| Cancel any enrollment | No | No | Yes |
| Mark enrollment as completed | No | No | Yes |

---

## 5. Rate Limiting

All rate limits use a **sliding window** (TTL in milliseconds).

| Endpoint / Group | Limit | Window |
|------------------|-------|--------|
| Global default | 100 requests | 60 seconds |
| `POST /auth/register` | 5 | 60 seconds |
| `POST /auth/login` | 5 | 60 seconds |
| `POST /auth/refresh` | 5 | 60 seconds |
| `POST /auth/send-verification` | 3 | 10 minutes |
| `POST /enrollments` | 5 | 60 seconds |
| `POST /enrollments/bulk` | 5 | 60 seconds |
| `POST /auth/oauth` | 5 | 60 seconds |
| `POST /forum/threads/:id/posts` | 10 | 60 seconds |
| `POST /messages/:userId` | 20 | 60 seconds |
| `POST /upload/avatar` | 10 | 60 seconds |
| `POST /upload/course-cover` | 10 | 60 seconds |
| `POST /upload/lesson-video` | 10 | 60 seconds |
| `POST /upload/assignment-file` | 3 | 60 seconds |
| `GET /health` | 60 | 60 seconds |
| WebSocket messages (both namespaces) | 20 events | 10 seconds (per connection) |

When rate limited, the response is `429 Too Many Requests`.

---

## 6. Endpoint Reference

---

### Health

#### `GET /api/v1/health`
**Auth**: None (`@Public`) | **Rate limit**: 60/min

**Response** (`200` or `503`):
```json
{
  "status": "ok",
  "timestamp": "2026-05-24T10:00:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok"
  }
}
```

**Status values**: `ok` | `degraded` | `error`. Returns `503` only when **all** services fail.

**Notes**: This endpoint bypasses the global response interceptor — the JSON above is returned directly (not wrapped in `{ data: ... }`).

---

### Auth

#### `POST /api/v1/auth/register`
**Auth**: None (`@Public`) | **Rate limit**: 5/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email |
| `password` | string | Yes | Min 8 characters |
| `firstName` | string | Yes | Min 2 characters |
| `lastName` | string | Yes | Min 2 characters |

**Response** (`201`):
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "clxyz123",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["STUDENT"],
    "avatarUrl": null,
    "isVerified": false,
    "createdAt": "2026-05-24T10:00:00.000Z",
    "updatedAt": "2026-05-24T10:00:00.000Z"
  }
}
```

**Errors**: `400` validation failed, `409` email already in use, `429` rate limited.

**Notes**: New accounts are always created with role `STUDENT`. `Cache-Control: no-store` is set on the response.

---

#### `POST /api/v1/auth/login`
**Auth**: None (`@Public`) | **Rate limit**: 5/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email |
| `password` | string | Yes | Min 8 characters |

**Response** (`200`): Same shape as register.

**Errors**: `400` validation, `401` invalid credentials, `429` rate limited.

---

#### `POST /api/v1/auth/oauth`
**Auth**: None (`@Public`) | **Rate limit**: 5/min

Logs in or registers a user via an OAuth provider (Google or Microsoft). If no account exists for the given `providerAccountId`, one is created automatically.

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | Yes | Valid email address from the provider |
| `firstName` | string | Yes | Min 2 characters |
| `lastName` | string | Yes | Min 2 characters |
| `avatarUrl` | string | No | Valid URL; provider profile photo |
| `provider` | string | Yes | Enum: `google` \| `microsoft` |
| `providerAccountId` | string | Yes | Subject ID from the OAuth provider (1–256 chars) |

**Response** (`200`): Same shape as `POST /auth/login` — `{ accessToken, refreshToken, user }`.

**Errors**: `400` validation failed, `429` rate limited.

**Security note**: This endpoint accepts OAuth claims from the frontend after the OAuth flow completes. See [MISTAKES.md #016](../MISTAKES.md) — server-side token verification with the provider is planned for a future release.

---

#### `POST /api/v1/auth/refresh`
**Auth**: None (`@Public`) | **Rate limit**: 5/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `refreshToken` | string | Yes | Must be a valid JWT string |

**Response** (`200`): Same shape as register (new token pair issued; old refresh token is revoked).

**Errors**: `400` validation, `401` token invalid or revoked, `429` rate limited.

---

#### `POST /api/v1/auth/logout`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `refreshToken` | string | Yes | Must be a valid JWT string |

**Response** (`200`): `{ "data": null, "timestamp": "..." }`

**Notes**: Revokes the refresh token in Redis. The access token remains valid until its natural 15-minute expiry, but the session is marked revoked so WebSocket connections will also be rejected.

---

#### `GET /api/v1/auth/me`
**Auth**: Required

**Response** (`200`):
```json
{
  "id": "clxyz123",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roles": ["STUDENT"],
  "avatarUrl": null,
  "isVerified": false,
  "createdAt": "2026-05-24T10:00:00.000Z",
  "updatedAt": "2026-05-24T10:00:00.000Z"
}
```

---

#### `POST /api/v1/auth/send-verification`
**Auth**: Required | **Rate limit**: 3 per 10 minutes

**Request Body**: None

**Response** (`200`):
```json
{ "code": "123456" }
```

**Notes**: Returns the 6-digit code directly (development convenience — production would email it). Rate limit is 3 requests per 10-minute window.

---

#### `POST /api/v1/auth/verify-email`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | Yes | Exactly 6 characters |

**Response** (`200`): `{ "data": null, "timestamp": "..." }`

**Errors**: `400` invalid or expired code.

---

### Users

#### `GET /api/v1/users/me`
**Auth**: Required

**Response** (`200`):
```json
{
  "id": "clxyz123",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roles": ["STUDENT"],
  "avatarUrl": null,
  "isVerified": false,
  "createdAt": "2026-05-24T10:00:00.000Z",
  "updatedAt": "2026-05-24T10:00:00.000Z"
}
```

---

#### `PATCH /api/v1/users/me`
**Auth**: Required

**Request Body** (all fields optional):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `firstName` | string | No | Min 2 characters |
| `lastName` | string | No | Min 2 characters |
| `avatarUrl` | string | No | Valid URL |

**Response** (`200`): Same shape as `GET /users/me`.

---

#### `PATCH /api/v1/users/me/password`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `currentPassword` | string | Yes | Min 8 characters |
| `newPassword` | string | Yes | Min 8 characters |

**Response** (`204`): No body.

**Errors**: `401` current password incorrect.

---

#### `DELETE /api/v1/users/me`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `password` | string | Yes | Min 8 characters (confirms deletion) |

**Response** (`204`): No body.

**Errors**: `401` password incorrect.

---

#### `GET /api/v1/users`
**Auth**: Required | **Roles**: ADMIN

**Query Parameters** (pagination):
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |

**Response** (`200`): Paginated list of `UserPrivateResponseDto` (same shape as `GET /users/me`).

---

#### `GET /api/v1/users/:id`
**Auth**: None (`@Public`)

**Response** (`200`):
```json
{
  "id": "clxyz123",
  "firstName": "John",
  "lastName": "Doe",
  "avatarUrl": null
}
```

**Notes**: Returns only public fields (no email or roles).

---

### Categories

#### `GET /api/v1/categories`
**Auth**: None (`@Public`)

**Response** (`200`): Array of categories.
```json
[
  { "id": "clcat1", "name": "Web Development", "slug": "web-development" }
]
```

---

#### `POST /api/v1/categories`
**Auth**: Required | **Roles**: ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Min 2 characters |

**Response** (`201`): `{ "id": "...", "name": "...", "slug": "..." }`

**Notes**: Slug is auto-generated from name.

---

#### `PATCH /api/v1/categories/:id`
**Auth**: Required | **Roles**: ADMIN

**Request Body**: Same as create (all fields optional).

**Response** (`200`): Category object.

---

#### `DELETE /api/v1/categories/:id`
**Auth**: Required | **Roles**: ADMIN

**Response** (`204`): No body.

**Errors**: `409` if the category has courses assigned.

---

### Courses

#### `GET /api/v1/courses`
**Auth**: None (`@Public`)

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max 100) |
| `categoryId` | UUID | — | Filter by category |

**Notes**: Unauthenticated users and students see only `PUBLISHED` courses. Instructors see their own courses at all statuses via `GET /courses/my`. Admins see all.

**Response** (`200`): Paginated list of `CourseResponseDto`.
```json
{
  "id": "clcourse1",
  "title": "Introduction to TypeScript",
  "slug": "introduction-to-typescript",
  "description": "Learn TypeScript from scratch",
  "coverUrl": "https://cdn.example.com/cover.jpg",
  "status": "PUBLISHED",
  "price": 29.99,
  "instructorId": "clinstructor1",
  "categoryId": "clcat1",
  "createdAt": "2026-05-24T10:00:00.000Z",
  "updatedAt": "2026-05-24T10:00:00.000Z"
}
```

---

#### `GET /api/v1/courses/my`
**Auth**: Required | **Roles**: INSTRUCTOR

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of the instructor's own courses (all statuses).

---

#### `GET /api/v1/courses/:id`
**Auth**: None (`@Public`)

**Response** (`200`): `CourseDetailResponseDto` — same as `CourseResponseDto` with additional fields:
```json
{
  "...all CourseResponseDto fields...",
  "lessonsCount": 12,
  "enrollmentsCount": 340
}
```

**Notes**: DRAFT/ARCHIVED courses are visible to the course owner and admins. Students/unauthenticated users get `404` for non-published courses.

---

#### `POST /api/v1/courses`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 3 characters |
| `description` | string | No | Free text |
| `coverUrl` | string | No | Valid URL |
| `categoryId` | UUID | No | Existing category ID |
| `price` | number | No | Positive number (USD); omit for free course |

**Response** (`201`): `CourseResponseDto` with `status: "DRAFT"`.

**Errors**: `409` slug conflict (duplicate title).

---

#### `PATCH /api/v1/courses/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseOwnerGuard

**Request Body**: All `CreateCourseDto` fields optional.

**Response** (`200`): Updated `CourseResponseDto`.

**Errors**: `403` not the course owner (unless ADMIN).

---

#### `PATCH /api/v1/courses/:id/publish`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseOwnerGuard

**Response** (`200`): `CourseResponseDto` with `status: "PUBLISHED"`.

---

#### `PATCH /api/v1/courses/:id/archive`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseOwnerGuard

**Response** (`200`): `CourseResponseDto` with `status: "ARCHIVED"`.

---

#### `DELETE /api/v1/courses/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseOwnerGuard

**Response** (`204`): No body.

**Errors**: `409` course has active enrollments.

---

### Course Modules

All module endpoints are nested under `/api/v1/courses/:courseId/modules`.

#### `GET /api/v1/courses/:courseId/modules`
**Auth**: None (`@Public`)

**Response** (`200`): Array of `ModuleResponseDto`.
```json
{
  "id": "clmod1",
  "courseId": "clcourse1",
  "title": "Getting Started",
  "description": "Introduction to fundamentals",
  "order": 1,
  "isPublished": true,
  "unlockAfterDays": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Notes**: Students and unauthenticated users see only published modules. Instructors and admins see all.

---

#### `GET /api/v1/courses/:courseId/modules/:id`
**Auth**: None (`@Public`)

**Response** (`200`): `ModuleDetailResponseDto` — module with embedded lessons array.
```json
{
  "...all ModuleResponseDto fields...",
  "lessons": [
    {
      "id": "cllesson1",
      "title": "Introduction to Variables",
      "order": 1,
      "type": "VIDEO",
      "duration": 300,
      "isPreview": false,
      "isPublished": true
    }
  ]
}
```

---

#### `POST /api/v1/courses/:courseId/modules`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseModuleOwnerGuard

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 3 characters |
| `description` | string | No | Free text |
| `order` | integer | No | Min 1; auto-assigned (last+1) if omitted |
| `unlockAfterDays` | integer | No | Min 0; days after enrollment before unlocking |

**Response** (`201`): `ModuleResponseDto`.

**Errors**: `409` duplicate order position.

---

#### `PATCH /api/v1/courses/:courseId/modules/reorder`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseModuleOwnerGuard

**Request Body**:
```json
{
  "items": [
    { "id": "module-uuid", "order": 1 },
    { "id": "module-uuid-2", "order": 2 }
  ]
}
```

**Response** (`200`): `{ "data": null, "timestamp": "..." }`

---

#### `PATCH /api/v1/courses/:courseId/modules/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseModuleOwnerGuard

**Request Body**: All `CreateModuleDto` fields optional.

**Response** (`200`): `ModuleResponseDto`.

---

#### `PATCH /api/v1/courses/:courseId/modules/:id/publish`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseModuleOwnerGuard

**Response** (`200`): `ModuleResponseDto` with `isPublished: true`.

---

#### `DELETE /api/v1/courses/:courseId/modules/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: CourseModuleOwnerGuard

**Response** (`204`): No body.

**Errors**: `409` module has published lessons.

---

### Lessons

All lesson endpoints are nested under `/api/v1/courses/:courseId/modules/:moduleId/lessons`.

#### `GET /api/v1/courses/:courseId/modules/:moduleId/lessons`
**Auth**: None (`@Public`)

**Response** (`200`): Array of `LessonResponseDto`.
```json
{
  "id": "cllesson1",
  "moduleId": "clmod1",
  "title": "Introduction to Variables",
  "order": 1,
  "type": "VIDEO",
  "content": null,
  "videoUrl": "https://cdn.example.com/video.mp4",
  "duration": 480,
  "isPreview": false,
  "isPublished": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Notes**: Students see only published lessons. Instructors and admins see all.

---

#### `GET /api/v1/courses/:courseId/modules/:moduleId/lessons/:id`
**Auth**: None (`@Public`)

**Response** (`200`): `LessonDetailResponseDto` — lesson with resources, quiz settings, and assignment settings.
```json
{
  "...all LessonResponseDto fields...",
  "resources": [
    {
      "id": "clres1",
      "title": "Course Slides",
      "url": "https://example.com/slides.pdf",
      "type": "pdf",
      "createdAt": "..."
    }
  ],
  "quizSettings": {
    "id": "clquiz1",
    "maxAttempts": 3,
    "passingScore": 70,
    "blocksProgress": false,
    "shuffleQuestions": false
  },
  "assignmentSettings": {
    "id": "classign1",
    "gradingType": "MANUAL",
    "maxScore": 100,
    "passingScore": 60,
    "dueDate": null,
    "allowLateSubmission": false
  }
}
```

**Notes**: Enrolled lesson detail is accessible only to enrolled students (or course owner/admin). Non-enrolled users receive `403`. Preview lessons (`isPreview: true`) are accessible without enrollment.

---

#### `POST /api/v1/courses/:courseId/modules/:moduleId/lessons`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 3 characters |
| `type` | string | Yes | Enum: `VIDEO`, `TEXT`, `QUIZ`, `ASSIGNMENT` |
| `order` | integer | No | Min 1; auto-assigned if omitted |
| `content` | string | No | Rich text content |
| `videoUrl` | string | No | Valid URL; **required when `type` is `VIDEO`** |
| `duration` | integer | No | Duration in seconds (min 0) |
| `isPreview` | boolean | No | Default `false`; allows non-enrolled access |

**Response** (`201`): `LessonResponseDto`.

**Errors**: `409` duplicate order position.

---

#### `PATCH /api/v1/courses/:courseId/modules/:moduleId/lessons/reorder`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Request Body**:
```json
{
  "items": [
    { "id": "lesson-uuid", "order": 1 },
    { "id": "lesson-uuid-2", "order": 2 }
  ]
}
```

**Response** (`200`): `{ "data": null, "timestamp": "..." }`

---

#### `PATCH /api/v1/courses/:courseId/modules/:moduleId/lessons/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Request Body**: All `CreateLessonDto` fields optional.

**Response** (`200`): `LessonResponseDto`.

---

#### `PATCH /api/v1/courses/:courseId/modules/:moduleId/lessons/:id/publish`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Response** (`200`): `LessonResponseDto` with `isPublished: true`.

---

#### `PATCH /api/v1/courses/:courseId/modules/:moduleId/lessons/:id/progress`
**Auth**: Required (enrolled student)

**Request Body** (all optional):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `watchedSeconds` | integer | No | Min 0; total seconds watched |
| `completed` | boolean | No | `true` to mark lesson complete |

**Response** (`200`): `LessonProgressResponseDto`.
```json
{
  "id": "clprog1",
  "enrollmentId": "clenroll1",
  "lessonId": "cllesson1",
  "isLocked": false,
  "startedAt": "2026-05-24T09:00:00.000Z",
  "completedAt": "2026-05-24T09:30:00.000Z",
  "lastWatchedAt": "2026-05-24T09:30:00.000Z",
  "watchedSeconds": 480
}
```

**Errors**: `403` not enrolled.

---

#### `DELETE /api/v1/courses/:courseId/modules/:moduleId/lessons/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Response** (`204`): No body.

**Errors**: `409` lesson has existing student progress records.

---

#### `POST /api/v1/courses/:courseId/modules/:moduleId/lessons/:id/resources`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 1 character |
| `url` | string | Yes | Valid URL |
| `type` | string | Yes | File type identifier (e.g., `pdf`, `zip`, `link`) |

**Response** (`201`): `LessonResourceDto`.
```json
{
  "id": "clres1",
  "title": "Course Slides",
  "url": "https://example.com/slides.pdf",
  "type": "pdf",
  "createdAt": "..."
}
```

---

#### `DELETE /api/v1/courses/:courseId/modules/:moduleId/lessons/:id/resources/:resourceId`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Guard**: LessonOwnerGuard

**Response** (`204`): No body.

---

### Enrollments

#### `POST /api/v1/enrollments`
**Auth**: Required | **Rate limit**: 5/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `courseId` | UUID | Yes | Existing published course ID |
| `code` | string | No | Enrollment code — **required** when the course `enrollmentType` is `CODE` |

**Response** (`201`): `EnrollmentResponseDto`.
```json
{
  "id": "clenroll1",
  "userId": "cluser1",
  "courseId": "clcourse1",
  "status": "ACTIVE",
  "completedAt": null,
  "enrolledAt": "2026-05-24T10:00:00.000Z",
  "updatedAt": "2026-05-24T10:00:00.000Z"
}
```

**Errors**: `400` course not available or code missing/invalid for CODE courses, `403` email not verified, instructor self-enrollment, or student attempting enrollment in ASSIGNED/CORPORATE-mode course, `409` already enrolled or course is full.

**Enrollment types** — behavior varies by `course.enrollmentType`:
| Type | Behavior |
|------|----------|
| `FREE` | Any verified user may self-enroll |
| `PAID` | Self-enrollment allowed; payment integration handled externally |
| `ASSIGNED` | Only ADMIN or INSTRUCTOR may call this endpoint; students receive `403` |
| `CODE` | `code` field is required; validated against active enrollment codes for the course |

**Portal mode** — when `PORTAL_MODE=CORPORATE`, only ADMIN/INSTRUCTOR may enroll (students receive `403` regardless of `enrollmentType`). When `PORTAL_MODE=ACADEMIC`, both enrollment start and end dates must be set and `now` must fall within the window.

---

#### `GET /api/v1/enrollments`
**Auth**: Required

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of the current user's enrollments.

---

#### `GET /api/v1/enrollments/course/:courseId`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of `CourseEnrollmentItemDto` — includes user identity and progress percentage.
```json
{
  "enrollmentId": "clenroll1",
  "userId": "cluser1",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "avatarUrl": null,
  "status": "ACTIVE",
  "enrolledAt": "2026-05-24T10:00:00.000Z",
  "progressPercentage": 41.7
}
```

---

#### `GET /api/v1/enrollments/:id`
**Auth**: Required

**Response** (`200`): `EnrollmentDetailResponseDto`.
```json
{
  "...all EnrollmentResponseDto fields...",
  "progress": {
    "totalLessons": 12,
    "completedLessons": 5,
    "progressPercentage": 41.7,
    "finalGrade": 87.5,
    "status": "ACTIVE"
  }
}
```

**Errors**: `403` not your enrollment (unless ADMIN).

---

#### `GET /api/v1/enrollments/:id/progress-summary`
**Auth**: Required

**Response** (`200`): `ProgressSummaryDto` (same as the `progress` object above).

**Errors**: `403` not your enrollment (unless ADMIN).

---

#### `DELETE /api/v1/enrollments/:id`
**Auth**: Required

**Response** (`204`): No body.

**Notes**: Student cancels own enrollment; ADMIN can cancel any. `409` if the enrollment is already completed.

---

#### `PATCH /api/v1/enrollments/:id/complete`
**Auth**: Required | **Roles**: ADMIN

**Response** (`200`): `EnrollmentResponseDto` with `status: "COMPLETED"`.

**Errors**: `409` enrollment is not active.

---

#### `POST /api/v1/enrollments/bulk`
**Auth**: Required | **Roles**: ADMIN | **Rate limit**: 5/min

Bulk-enrolls multiple users into a single course in one atomic transaction. Users already ACTIVE or COMPLETED are silently skipped. CANCELLED enrollments are reactivated. Non-existent user IDs are counted as `failed`.

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `userIds` | UUID[] | Yes | 1–100 user IDs |
| `courseId` | UUID | Yes | Existing published course ID |

**Response** (`201`): `BulkEnrollResultDto`.
```json
{
  "enrolled": 8,
  "skipped": 2,
  "failed": 0
}
```

| Field | Meaning |
|-------|---------|
| `enrolled` | Users successfully (re-)enrolled |
| `skipped` | Users who were already ACTIVE or COMPLETED — unchanged |
| `failed` | User IDs that did not match any existing user |

**Errors**: `400` course is not PUBLISHED, `403` ADMIN only, `404` course not found.

---

### Quiz

All quiz endpoints are nested under `/api/v1/lessons/:lessonId/quiz`. The lesson must be of type `QUIZ`.

#### `POST /api/v1/lessons/:lessonId/quiz/settings`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body** (all optional):
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `maxAttempts` | integer | No | Min 1 |
| `passingScore` | integer | No | 0–100 |
| `blocksProgress` | boolean | No | If true, quiz must pass before next lesson unlocks |
| `shuffleQuestions` | boolean | No | Randomize question order per attempt |

**Response** (`200`): `QuizSettingsResponseDto`.
```json
{
  "id": "clqsettings1",
  "lessonId": "cllesson1",
  "maxAttempts": 3,
  "passingScore": 70,
  "blocksProgress": false,
  "shuffleQuestions": true
}
```

**Notes**: Upsert — creates if not exists, updates if exists.

---

#### `GET /api/v1/lessons/:lessonId/quiz/settings`
**Auth**: Required

**Response** (`200`): `QuizSettingsResponseDto`.

---

#### `POST /api/v1/lessons/:lessonId/quiz/questions`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `text` | string | Yes | Min 1 character |
| `type` | string | Yes | Enum: `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `TRUE_FALSE`, `SHORT_TEXT`, `LONG_TEXT` |
| `order` | integer | No | Min 1; auto-assigned if omitted |
| `points` | integer | No | Min 1; default 1 |
| `options` | array | No | Required for `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `TRUE_FALSE` |

`options` item structure:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `text` | string | Yes | Min 1 character |
| `isCorrect` | boolean | Yes | Whether this is the correct answer |
| `order` | integer | Yes | Min 1 |

**Response** (`201`): `QuestionResponseDto`.
```json
{
  "id": "clq1",
  "lessonId": "cllesson1",
  "text": "What is TypeScript?",
  "type": "SINGLE_CHOICE",
  "order": 1,
  "points": 1,
  "options": [
    { "id": "clopt1", "text": "A typed superset of JavaScript", "order": 1 }
  ]
}
```

**Notes**: `isCorrect` is hidden from students until their attempt is complete.

---

#### `GET /api/v1/lessons/:lessonId/quiz/questions`
**Auth**: Required

**Response** (`200`): Array of `QuestionResponseDto`.

**Notes**: Students receive questions shuffled (if `shuffleQuestions` is enabled) and without `isCorrect` on options until they have completed an attempt. Instructors and admins see full data.

---

#### `PATCH /api/v1/lessons/:lessonId/quiz/questions/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**: All `CreateQuestionDto` fields optional.

**Response** (`200`): `QuestionResponseDto`.

---

#### `DELETE /api/v1/lessons/:lessonId/quiz/questions/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

---

#### `POST /api/v1/lessons/:lessonId/quiz/attempts`
**Auth**: Required (enrolled student)

**Response** (`201`): `AttemptSummaryDto`.
```json
{
  "id": "clattempt1",
  "lessonId": "cllesson1",
  "enrollmentId": "clenroll1",
  "attemptNumber": 1,
  "score": null,
  "startedAt": "2026-05-24T10:00:00.000Z",
  "completedAt": null,
  "passed": null
}
```

**Errors**: `409` max attempts reached.

---

#### `POST /api/v1/lessons/:lessonId/quiz/attempts/:attemptId/submit`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `answers` | array | Yes | Array of answer items |

Answer item:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `questionId` | UUID | Yes | |
| `selectedOptionId` | UUID | No | For choice-type questions |
| `textAnswer` | string | No | Max 10,000 chars; for text-type questions |

**Response** (`201`): `AttemptResultDto` — attempt summary with scored answers.
```json
{
  "...all AttemptSummaryDto fields...",
  "answers": [
    {
      "id": "clans1",
      "questionId": "clq1",
      "selectedOptionId": "clopt1",
      "textAnswer": null,
      "isCorrect": true
    }
  ]
}
```

**Notes**: Auto-grading for `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `TRUE_FALSE`. Text answers receive `isCorrect: null` (manual review needed).

---

#### `GET /api/v1/lessons/:lessonId/quiz/attempts`
**Auth**: Required

**Response** (`200`): Array of `AttemptSummaryDto` (own attempts only for students).

---

#### `GET /api/v1/lessons/:lessonId/quiz/attempts/all`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`200`): Array of all students' `AttemptSummaryDto`.

---

#### `GET /api/v1/lessons/:lessonId/quiz/attempts/:attemptId`
**Auth**: Required

**Response** (`200`): `AttemptResultDto`.

---

### Assignments

All assignment endpoints are nested under `/api/v1/lessons/:lessonId/assignment`. The lesson must be of type `ASSIGNMENT`.

#### `POST /api/v1/lessons/:lessonId/assignment/settings`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `gradingType` | string | Yes | Enum: `AUTOMATIC`, `MANUAL` |
| `maxScore` | integer | Yes | Min 1 |
| `passingScore` | integer | No | Min 0 |
| `dueDate` | ISO date string | No | e.g. `"2026-06-01T23:59:59.000Z"` |
| `allowLateSubmission` | boolean | No | Default `false` |
| `isGroupAssignment` | boolean | No | Default `false` |
| `groupId` | UUID | No | Required if `isGroupAssignment` is `true` |
| `maxAttempts` | integer | No | Min 1; `null` = unlimited |

**Response** (`200`): `AssignmentSettingsResponseDto`.
```json
{
  "id": "classsettings1",
  "lessonId": "cllesson1",
  "gradingType": "MANUAL",
  "maxScore": 100,
  "passingScore": 60,
  "dueDate": null,
  "allowLateSubmission": false,
  "isGroupAssignment": false,
  "groupId": null,
  "maxAttempts": null
}
```

---

#### `GET /api/v1/lessons/:lessonId/assignment/settings`
**Auth**: Required

**Response** (`200`): `AssignmentSettingsResponseDto`.

---

#### `POST /api/v1/lessons/:lessonId/assignment/submit`
**Auth**: Required (enrolled student)

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | string | Yes | Min 1, max 50,000 characters |
| `fileUrl` | string | No | Valid URL (use upload endpoint first) |

**Response** (`201`): `SubmissionResponseDto`.
```json
{
  "id": "clsub1",
  "enrollmentId": "clenroll1",
  "lessonId": "cllesson1",
  "content": "My submission...",
  "fileUrl": "https://cdn.example.com/file.pdf",
  "submittedAt": "2026-05-24T10:00:00.000Z",
  "attemptNumber": 1,
  "grade": null,
  "feedback": null,
  "gradedById": null,
  "gradedAt": null,
  "groupId": null
}
```

---

#### `GET /api/v1/lessons/:lessonId/assignment/submissions/mine`
**Auth**: Required

**Response** (`200`): Array of own `SubmissionResponseDto`.

---

#### `GET /api/v1/lessons/:lessonId/assignment/submissions`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`200`): Array of all `SubmissionResponseDto` for the lesson.

---

#### `GET /api/v1/lessons/:lessonId/assignment/submissions/pending`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`200`): Array of ungraded `SubmissionResponseDto`.

---

#### `GET /api/v1/lessons/:lessonId/assignment/submissions/:submissionId`
**Auth**: Required

**Response** (`200`): Single `SubmissionResponseDto`.

---

#### `PATCH /api/v1/lessons/:lessonId/assignment/submissions/:submissionId/grade`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `grade` | integer | Yes | Min 0 |
| `feedback` | string | No | Optional text |
| `rubricAnswers` | array | No | Required if the lesson has a rubric assigned |

`rubricAnswers` item:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `criterionId` | UUID | Yes | |
| `levelId` | UUID | No | |
| `pointsAwarded` | number | Yes | Min 0 |
| `feedback` | string | No | Per-criterion feedback |

**Response** (`200`): Graded `SubmissionResponseDto`.

---

### Rubrics

All rubric endpoints are nested under `/api/v1/courses/:courseId/rubrics`.

#### `GET /api/v1/courses/:courseId/rubrics`
**Auth**: Required

**Response** (`200`): Array of `RubricSummaryResponseDto` (no criteria included).
```json
{
  "id": "clrubric1",
  "courseId": "clcourse1",
  "title": "Final Project Rubric",
  "description": null,
  "totalPoints": 100,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### `POST /api/v1/courses/:courseId/rubrics`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 2 characters |
| `description` | string | No | |
| `totalPoints` | integer | Yes | Min 1 |
| `criteria` | array | Yes | At least one criterion |

Criterion item:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 1 character |
| `description` | string | No | |
| `order` | integer | Yes | Min 1 |
| `points` | integer | Yes | Min 0 |
| `levels` | array | Yes | Performance levels |

Level item:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 1 character |
| `description` | string | No | |
| `points` | integer | Yes | Min 0 |
| `order` | integer | Yes | Min 1 |

**Response** (`201`): `RubricResponseDto` with full criteria and levels.

---

#### `GET /api/v1/courses/:courseId/rubrics/:id`
**Auth**: Required

**Response** (`200`): `RubricResponseDto` with full criteria and levels.

---

#### `PATCH /api/v1/courses/:courseId/rubrics/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**: All `CreateRubricDto` fields optional.

**Response** (`200`): `RubricResponseDto`.

---

#### `DELETE /api/v1/courses/:courseId/rubrics/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

**Errors**: `409` rubric has existing assessments.

---

#### `POST /api/v1/courses/:courseId/rubrics/:id/assess/:submissionId`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `feedback` | string | No | Overall assessment feedback |
| `answers` | array | Yes | Per-criterion answers |

Answer item:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `criterionId` | UUID | Yes | |
| `levelId` | UUID | No | |
| `pointsAwarded` | number | Yes | Min 0 |
| `feedback` | string | No | |

**Response** (`201`): `RubricAssessmentResponseDto`.

---

#### `GET /api/v1/courses/:courseId/rubrics/:id/assess/:submissionId`
**Auth**: Required

**Response** (`200`): `RubricAssessmentResponseDto`.

---

### Gradebook

All gradebook endpoints are nested under `/api/v1/courses/:courseId/gradebook`.

#### `GET /api/v1/courses/:courseId/gradebook`
**Auth**: Required

**Response** (`200`): `GradebookResponseDto` — full category and item structure.
```json
{
  "courseId": "clcourse1",
  "categories": [
    {
      "id": "clcat1",
      "courseId": "clcourse1",
      "name": "Quizzes",
      "weight": 30,
      "order": 1,
      "items": [
        {
          "id": "clitem1",
          "categoryId": "clcat1",
          "lessonId": "cllesson1",
          "weight": null,
          "maxScore": 100,
          "isExtraCredit": false
        }
      ]
    }
  ],
  "totalWeight": 100
}
```

---

#### `POST /api/v1/courses/:courseId/gradebook/categories`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Min 2 characters |
| `weight` | number | Yes | 0–100 (percentage) |
| `order` | integer | Yes | Min 1 |

**Response** (`201`): `GradebookCategoryResponseDto`.

---

#### `PATCH /api/v1/courses/:courseId/gradebook/categories/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**: All `CreateGradebookCategoryDto` fields optional.

**Response** (`200`): `GradebookCategoryResponseDto`.

---

#### `DELETE /api/v1/courses/:courseId/gradebook/categories/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

**Errors**: `409` category still has items.

---

#### `POST /api/v1/courses/:courseId/gradebook/items`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `lessonId` | UUID | Yes | Must be a lesson in this course |
| `categoryId` | UUID | Yes | Must be a category in this course |
| `weight` | number | No | Min 0; `null` = equal weight |
| `maxScore` | number | Yes | Min 0 |
| `isExtraCredit` | boolean | No | Default `false` |

**Response** (`201`): `GradebookItemResponseDto`.

---

#### `DELETE /api/v1/courses/:courseId/gradebook/items/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

---

#### `GET /api/v1/courses/:courseId/gradebook/student/:enrollmentId`
**Auth**: Required

**Response** (`200`): `StudentGradeResponseDto`.
```json
{
  "enrollmentId": "clenroll1",
  "courseId": "clcourse1",
  "finalGrade": 87.5,
  "categories": [
    {
      "categoryId": "clcat1",
      "categoryName": "Quizzes",
      "categoryWeight": 30,
      "categoryScore": 90.0,
      "items": [
        {
          "itemId": "clitem1",
          "lessonId": "cllesson1",
          "rawScore": 90,
          "maxScore": 100,
          "percentageScore": 90.0,
          "isExtraCredit": false
        }
      ]
    }
  ]
}
```

**Errors**: `403` cannot view another student's grade (unless instructor or admin).

---

### Groups

All group endpoints are nested under `/api/v1/courses/:courseId/groups`.

#### `GET /api/v1/courses/:courseId/groups`
**Auth**: Required

**Response** (`200`): Array of `GroupResponseDto`.
```json
{
  "id": "clgroup1",
  "courseId": "clcourse1",
  "name": "Team Alpha",
  "description": "First project group",
  "maxMembers": 5,
  "memberCount": 3,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### `POST /api/v1/courses/:courseId/groups`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Min 2 characters |
| `description` | string | No | |
| `maxMembers` | integer | No | Min 1; `null` = unlimited |

**Response** (`201`): `GroupResponseDto`.

**Errors**: `409` group name already exists in this course.

---

#### `PATCH /api/v1/courses/:courseId/groups/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**: All `CreateGroupDto` fields optional.

**Response** (`200`): `GroupResponseDto`.

---

#### `DELETE /api/v1/courses/:courseId/groups/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

**Errors**: `409` group has members.

---

#### `POST /api/v1/courses/:courseId/groups/:id/members`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `userId` | UUID | Yes | Must be enrolled in the course |

**Response** (`201`): `GroupMemberResponseDto`.
```json
{
  "id": "clmember1",
  "groupId": "clgroup1",
  "userId": "cluser1",
  "joinedAt": "..."
}
```

**Errors**: `400` user not enrolled, `409` user already in a group or group is full.

---

#### `DELETE /api/v1/courses/:courseId/groups/:id/members/:userId`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`204`): No body.

---

### Forum

#### `GET /api/v1/forum/threads`
**Auth**: None (`@Public`)

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | |
| `limit` | integer | `20` | |
| `courseId` | UUID | — | Filter threads scoped to a course |

**Response** (`200`): Paginated list of `ThreadResponseDto`.
```json
{
  "id": "clthread1",
  "title": "How do I implement authentication?",
  "authorId": "cluser1",
  "courseId": "clcourse1",
  "isPinned": false,
  "isClosed": false,
  "postCount": 5,
  "lastActivityAt": "2026-05-24T10:00:00.000Z",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### `GET /api/v1/forum/threads/:id`
**Auth**: None (`@Public`)

**Response** (`200`): `ThreadDetailResponseDto` — thread with posts array.
```json
{
  "...all ThreadResponseDto fields...",
  "posts": [
    {
      "id": "clpost1",
      "threadId": "clthread1",
      "authorId": "cluser1",
      "content": "Here is my answer...",
      "parentId": null,
      "isAcceptedAnswer": false,
      "voteScore": 3,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Errors**: `403` private forum and user is not enrolled.

---

#### `POST /api/v1/forum/threads`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 5 characters |
| `courseId` | UUID | No | Scope thread to a course forum |

**Response** (`201`): `ThreadResponseDto`.

**Errors**: `400` forum disabled for this course, `403` not enrolled or not authenticated.

---

#### `PATCH /api/v1/forum/threads/:id`
**Auth**: Required (thread author or ADMIN)

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | No | Min 5 characters |

**Response** (`200`): `ThreadResponseDto`.

---

#### `PATCH /api/v1/forum/threads/:id/pin`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`200`): `ThreadResponseDto` with toggled `isPinned`.

---

#### `PATCH /api/v1/forum/threads/:id/close`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Response** (`200`): `ThreadResponseDto` with toggled `isClosed`.

---

#### `DELETE /api/v1/forum/threads/:id`
**Auth**: Required (thread author or ADMIN)

**Response** (`204`): No body.

**Errors**: `409` thread has replies from other users (ADMIN bypasses this guard).

---

#### `POST /api/v1/forum/threads/:threadId/posts`
**Auth**: Required | **Rate limit**: 10/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | string | Yes | Min 1 character |
| `parentId` | UUID | No | Reply to an existing post (nested replies) |

**Response** (`201`): `PostResponseDto`.

**Errors**: `403` thread is closed or forum access denied.

---

#### `PATCH /api/v1/forum/threads/:threadId/posts/:id`
**Auth**: Required (post author only)

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | string | No | Min 1 character |

**Response** (`200`): `PostResponseDto`.

---

#### `PATCH /api/v1/forum/threads/:threadId/posts/:id/accept`
**Auth**: Required (thread author, course instructor, or ADMIN)

**Response** (`200`): `PostResponseDto` with toggled `isAcceptedAnswer`.

---

#### `POST /api/v1/forum/threads/:threadId/posts/:id/vote`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `value` | integer | Yes | `1` (upvote) or `-1` (downvote) |

**Response** (`204`): No body.

**Notes**: Submitting the same value twice removes the vote (toggle).

---

#### `DELETE /api/v1/forum/threads/:threadId/posts/:id`
**Auth**: Required (post author or ADMIN)

**Response** (`204`): No body.

---

### Messages

#### `GET /api/v1/messages`
**Auth**: Required

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated inbox — one entry per unique conversation partner.
```json
{
  "partnerId": "cluser2",
  "lastMessage": {
    "id": "clmsg1",
    "senderId": "cluser1",
    "receiverId": "cluser2",
    "content": "Hello!",
    "readAt": null,
    "createdAt": "..."
  },
  "unreadCount": 2
}
```

---

#### `GET /api/v1/messages/:userId`
**Auth**: Required

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated conversation with the specified user (chronological order).
```json
{
  "id": "clmsg1",
  "senderId": "cluser1",
  "receiverId": "cluser2",
  "content": "Hello!",
  "readAt": null,
  "createdAt": "..."
}
```

---

#### `POST /api/v1/messages/:userId`
**Auth**: Required | **Rate limit**: 20/min

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | string | Yes | Min 1 character |

**Response** (`201`): `MessageResponseDto`. Also triggers `newMessage` event on the receiver's WebSocket connection.

---

#### `PATCH /api/v1/messages/:userId/read`
**Auth**: Required

**Response** (`204`): No body. Marks all messages from `userId` as read. Also triggers `messagesRead` event on the sender's WebSocket.

---

### Notifications

#### `GET /api/v1/notifications`
**Auth**: Required

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | |
| `limit` | integer | `20` | |
| `isRead` | boolean | — | Filter by read status |

**Response** (`200`): Paginated list of `NotificationResponseDto`.
```json
{
  "id": "clnotif1",
  "userId": "cluser1",
  "type": "FORUM_REPLY",
  "title": "New reply on your thread",
  "body": "Someone replied to your question.",
  "isRead": false,
  "referenceId": "clthread1",
  "referenceType": "thread",
  "createdAt": "..."
}
```

**Notification types**: `ENROLLMENT`, `NEW_LESSON`, `FORUM_REPLY`, `ASSIGNMENT_GRADED`, `QUIZ_PASSED`, `QUIZ_FAILED`, `COURSE_COMPLETED`, `ANNOUNCEMENT`

---

#### `GET /api/v1/notifications/unread-count`
**Auth**: Required

**Response** (`200`):
```json
{ "count": 5 }
```

---

#### `PATCH /api/v1/notifications/read-all`
**Auth**: Required

**Response** (`204`): No body. Marks all notifications as read.

---

#### `PATCH /api/v1/notifications/:id/read`
**Auth**: Required

**Response** (`200`): `NotificationResponseDto` with `isRead: true`.

---

#### `DELETE /api/v1/notifications/:id`
**Auth**: Required

**Response** (`204`): No body.

---

### Ratings

#### `POST /api/v1/ratings`
**Auth**: Required (enrolled students only)

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `courseId` | UUID | Yes | Must be enrolled in this course |
| `score` | integer | Yes | 1–100 (interpretation depends on course `ratingScale`) |
| `review` | string | No | Max 1,000 characters |

**Response** (`201`): `RatingResponseDto`.
```json
{
  "id": "clrating1",
  "userId": "cluser1",
  "courseId": "clcourse1",
  "score": 80,
  "review": "Great course!",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

#### `PATCH /api/v1/ratings/:courseId`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `score` | integer | No | 1–100 |
| `review` | string | No | Max 1,000 characters |

**Response** (`200`): Updated `RatingResponseDto`.

---

#### `GET /api/v1/ratings/course/:courseId`
**Auth**: None (`@Public`)

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of `RatingResponseDto`.

---

#### `GET /api/v1/ratings/course/:courseId/summary`
**Auth**: None (`@Public`)

**Response** (`200`): `RatingSummaryDto`.
```json
{
  "averageScore": 82.5,
  "totalRatings": 37,
  "scale": "NUMERIC_100"
}
```

**Scale values**: `STARS_5`, `NUMERIC_10`, `NUMERIC_100`

---

### Announcements

#### `GET /api/v1/courses/:courseId/announcements`
**Auth**: None (`@Public`)

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of `AnnouncementResponseDto`.
```json
{
  "id": "clann1",
  "courseId": "clcourse1",
  "instructorId": "clinstructor1",
  "title": "Module 3 is now live",
  "body": "We have just published module 3. Check it out!",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Notes**: Enrolled students see all announcements; unauthenticated users see announcements for published courses only.

---

#### `POST /api/v1/courses/:courseId/announcements`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 3 characters |
| `body` | string | Yes | Min 1 character |

**Response** (`201`): `AnnouncementResponseDto`.

---

#### `PATCH /api/v1/courses/:courseId/announcements/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN (announcement author or ADMIN)

**Request Body**: `title` and `body` both optional.

**Response** (`200`): `AnnouncementResponseDto`.

---

#### `DELETE /api/v1/courses/:courseId/announcements/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN (announcement author or ADMIN)

**Response** (`204`): No body.

---

### Calendar

#### `GET /api/v1/calendar`
**Auth**: Required

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO date string | Filter events on or after this date |
| `endDate` | ISO date string | Filter events on or before this date |
| `type` | CalendarEventType | Filter by event type |

**Response** (`200`): Array of `CalendarEventResponseDto` — personal events + enrolled course events.

---

#### `GET /api/v1/courses/:courseId/calendar`
**Auth**: Required

**Query Parameters**: Same as `GET /calendar`.

**Response** (`200`): Array of `CalendarEventResponseDto` for the specified course.

---

#### `POST /api/v1/calendar`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | Min 2 characters |
| `type` | string | Yes | Enum: `ASSIGNMENT_DUE`, `QUIZ_DUE`, `LESSON_AVAILABLE`, `COURSE_START`, `COURSE_END`, `CUSTOM` |
| `startDate` | ISO date string | Yes | e.g. `"2026-06-01T09:00:00Z"` |
| `courseId` | UUID | No | Scope to a course |
| `description` | string | No | |
| `endDate` | ISO date string | No | |
| `allDay` | boolean | No | Default `false` |
| `color` | string | No | Hex color code (e.g. `"#FF5733"`) |
| `referenceId` | UUID | No | ID of the linked resource |
| `referenceType` | string | No | `"lesson"`, `"assignment"`, `"quiz"`, or `"module"` |

**Response** (`201`): `CalendarEventResponseDto`.
```json
{
  "id": "clcal1",
  "courseId": "clcourse1",
  "userId": "cluser1",
  "title": "Project Due",
  "description": "Final project submission deadline",
  "type": "ASSIGNMENT_DUE",
  "startDate": "2026-06-01T09:00:00.000Z",
  "endDate": "2026-06-01T17:00:00.000Z",
  "allDay": false,
  "color": "#FF5733",
  "referenceId": "cllesson1",
  "referenceType": "lesson",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Errors**: `403` non-instructor attempting to create a course-scoped event.

---

#### `PATCH /api/v1/calendar/:id`
**Auth**: Required (creator or ADMIN)

**Request Body**: All `CreateCalendarEventDto` fields optional.

**Response** (`200`): `CalendarEventResponseDto`.

---

#### `DELETE /api/v1/calendar/:id`
**Auth**: Required (creator or ADMIN)

**Response** (`204`): No body.

---

### Upload

All upload endpoints require authentication. Files are stored in Cloudflare R2 and a public CDN URL is returned.

#### `POST /api/v1/upload/avatar`
**Auth**: Required | **Rate limit**: 10/min | **Content-Type**: `multipart/form-data`

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `file` | binary | Yes | Max 5 MB; accepted: `image/jpeg`, `image/png`, `image/webp` |

**Response** (`201`):
```json
{ "url": "https://cdn.example.com/avatars/user-123/abc.jpg" }
```

**Notes**: After uploading, call `PATCH /api/v1/users/me` with `avatarUrl` set to the returned URL.

---

#### `POST /api/v1/upload/course-cover`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Rate limit**: 10/min | **Content-Type**: `multipart/form-data`

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `file` | binary | Yes | Max 5 MB; accepted: `image/jpeg`, `image/png`, `image/webp` |
| `courseId` | UUID | Yes | Must be a course you own |

**Response** (`201`):
```json
{ "url": "https://cdn.example.com/courses/course-id/cover.jpg" }
```

---

#### `POST /api/v1/upload/lesson-video`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN | **Rate limit**: 10/min | **Content-Type**: `application/json`

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `lessonId` | UUID | Yes | Must be a lesson you own |
| `contentType` | string | Yes | `"video/mp4"` or `"video/webm"` |

**Response** (`201`):
```json
{
  "uploadUrl": "https://r2.storage.com/lessons/course-id/lesson-id/abc.mp4?sig=...",
  "key": "lessons/course-id/lesson-id/abc.mp4",
  "publicUrl": "https://cdn.example.com/lessons/course-id/lesson-id/abc.mp4"
}
```

**Notes**: Returns a **presigned S3 PUT URL**. The frontend should `PUT` the video file directly to `uploadUrl` (bypassing the API server). After the upload, set `videoUrl` on the lesson using `PATCH /courses/:courseId/modules/:moduleId/lessons/:id` with `videoUrl: publicUrl`.

---

#### `POST /api/v1/upload/assignment-file`
**Auth**: Required | **Rate limit**: 3/min | **Content-Type**: `multipart/form-data`

**Form Fields**:
| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `file` | binary | Yes | Max 50 MB; accepted: `pdf`, `docx`, `zip`, `jpg`, `png` |

**Response** (`201`):
```json
{ "url": "https://cdn.example.com/submissions/user-id/abc.pdf" }
```

**Notes**: After uploading, include the URL as `fileUrl` in the assignment submission body.

---

### Admin

Admin impersonation lets an ADMIN experience the platform as a specific student or instructor without knowing their password. The impersonation session is capped at 60 minutes and cannot be renewed.

#### `POST /api/v1/admin/impersonate/:userId`
**Auth**: Required | **Roles**: ADMIN

Starts an impersonation session. Returns a new token pair scoped to the target user (their roles, not the admin's).

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | ID of the user to impersonate (STUDENT or INSTRUCTOR only) |

**Request Body**: None.

**Response** (`201`): `AuthResponseDto` — same shape as login. The returned `accessToken` carries the target user's roles and an additional `impersonatedBy` claim (the admin's user ID). The `refreshToken` is stored under a separate `impersonation:` Redis namespace and **cannot** be used to obtain a regular session.

**Errors**: `400` cannot impersonate yourself, `403` target is ADMIN or caller is already inside an impersonation session, `404` target user not found.

**Security notes**:
- Impersonation tokens expire in 60 minutes and are not renewable.
- Any DB writes made during impersonation are attributed to the **target user** (by design — the admin sees exactly what the target sees).
- Audit-sensitive features should inspect the `impersonatedBy` claim to distinguish real actions from observed ones.

---

#### `POST /api/v1/admin/impersonate/stop`
**Auth**: Required (caller must hold an impersonation access token — no `@Roles(ADMIN)` guard, as the token carries target-user roles)

Ends the impersonation session, revokes the impersonation tokens, and restores the admin's own session.

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `adminId` | UUID | Yes | ID of the admin whose session should be restored |

**Response** (`200`): `AuthResponseDto` — a fresh token pair for the admin (their own roles restored).

**Errors**: `400` no active impersonation session or `adminId` mismatch, `401` missing or invalid token.

---

### Maintenance

A lightweight maintenance-mode flag stored in Redis. When enabled, the frontend should display a maintenance banner or redirect to a static page. The API itself continues to function normally — it is up to the frontend to gate access.

#### `GET /api/v1/admin/maintenance`
**Auth**: None (`@Public`)

**Response** (`200`): `MaintenanceResponseDto`.
```json
{
  "enabled": false,
  "message": "",
  "estimatedEnd": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `enabled` | boolean | `true` while maintenance is active |
| `message` | string | Human-readable status message |
| `estimatedEnd` | string \| undefined | ISO 8601 estimated end time; omitted if not set |

---

#### `POST /api/v1/admin/maintenance`
**Auth**: Required | **Roles**: ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `enabled` | boolean | Yes | `true` to enable, `false` to disable |
| `message` | string | Yes | Status message shown to users (max 500 chars) |
| `estimatedEnd` | ISO date string | No | e.g. `"2026-06-01T04:00:00Z"` |

**Response** (`200`): `MaintenanceResponseDto` (updated state).

---

### Global Announcements

Platform-wide banners visible to all users regardless of enrollment. Controlled by admins. The frontend should poll `GET /announcements/global` on app load and display active announcements.

#### `GET /api/v1/announcements/global`
**Auth**: None (`@Public`)

Returns all announcements where `isActive` is `true` and `now` is within `[startsAt, endsAt]` (or dates are not set).

**Response** (`200`): Array of `GlobalAnnouncementResponseDto`.
```json
{
  "id": "clann1",
  "title": "Scheduled maintenance on Saturday",
  "message": "The platform will be offline from 02:00–04:00 UTC.",
  "type": "WARNING",
  "isActive": true,
  "startsAt": "2026-06-07T02:00:00.000Z",
  "endsAt": "2026-06-07T04:00:00.000Z",
  "createdBy": "cladmin1",
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-01T10:00:00.000Z"
}
```

**Type values**: `INFO` | `WARNING` | `MAINTENANCE` | `SUCCESS`

---

#### `POST /api/v1/announcements/global`
**Auth**: Required | **Roles**: ADMIN

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | string | Yes | 3–200 characters |
| `message` | string | Yes | 1–2000 characters |
| `type` | string | No | Enum: `INFO`, `WARNING`, `MAINTENANCE`, `SUCCESS`; default `INFO` |
| `startsAt` | ISO date string | No | Announcement becomes visible at this time |
| `endsAt` | ISO date string | No | Announcement stops being visible at this time |

**Response** (`201`): `GlobalAnnouncementResponseDto`.

---

#### `PATCH /api/v1/announcements/global/:id`
**Auth**: Required | **Roles**: ADMIN

**Request Body**: All `CreateGlobalAnnouncementDto` fields optional.

**Response** (`200`): Updated `GlobalAnnouncementResponseDto`.

**Errors**: `404` announcement not found.

---

#### `DELETE /api/v1/announcements/global/:id`
**Auth**: Required | **Roles**: ADMIN

**Response** (`204`): No body.

**Errors**: `404` announcement not found.

---

### Enrollment Codes

Enrollment codes restrict access to `CODE`-type courses. Only the course owner (INSTRUCTOR) or an ADMIN can manage codes. Students supply a code in `POST /enrollments` to gain access.

#### `GET /api/v1/courses/:courseId/enrollment-codes`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN (course owner or admin)

**Response** (`200`): Array of `EnrollmentCodeResponseDto`.
```json
{
  "id": "clcode1",
  "courseId": "clcourse1",
  "code": "ML2026",
  "maxUses": 50,
  "usedCount": 12,
  "expiresAt": null,
  "isActive": true,
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

**Errors**: `403` not the course owner (unless ADMIN), `404` course not found.

---

#### `POST /api/v1/courses/:courseId/enrollment-codes`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN (course owner or admin)

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `code` | string | Yes | 3–50 characters; must be globally unique |
| `maxUses` | integer | No | Min 1; `null` = unlimited uses |
| `expiresAt` | ISO date string | No | e.g. `"2026-12-31T23:59:59Z"`; `null` = never expires |

**Response** (`201`): `EnrollmentCodeResponseDto`.

**Errors**: `403` not the course owner (unless ADMIN), `404` course not found, `409` code string already in use.

---

#### `DELETE /api/v1/courses/:courseId/enrollment-codes/:id`
**Auth**: Required | **Roles**: INSTRUCTOR, ADMIN (course owner or admin)

Soft-deletes the code by setting `isActive: false`. The code record is retained for audit purposes.

**Response** (`204`): No body.

**Errors**: `403` not the course owner (unless ADMIN), `404` code not found in this course.

---

### Bulk Enrollment

See [`POST /api/v1/enrollments/bulk`](#post-apiv1enrollmentsbulk) in the Enrollments section above.

---

### User Assignments

Admin-only endpoints for managing a specific user's course assignments from the user-centric direction.

#### `GET /api/v1/users/:userId/enrollments`
**Auth**: Required | **Roles**: ADMIN

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of `UserEnrollmentItemDto`.
```json
{
  "enrollmentId": "clenroll1",
  "courseId": "clcourse1",
  "courseTitle": "Machine Learning Práctico",
  "coverUrl": "https://cdn.example.com/cover.jpg",
  "enrollmentType": "CODE",
  "status": "ACTIVE",
  "progressPercentage": 33.3,
  "enrolledAt": "2026-05-24T10:00:00.000Z"
}
```

---

#### `DELETE /api/v1/users/:userId/enrollments/:courseId`
**Auth**: Required | **Roles**: ADMIN

Hard-deletes the enrollment (and all associated progress, attempts, submissions via cascade). Use this to remove a manually-assigned student from a course.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | User to remove |
| `courseId` | UUID | Course to remove them from |

**Response** (`204`): No body.

**Errors**: `404` enrollment not found, `409` cannot remove a COMPLETED enrollment.

---

### Lesson Notes

Per-user, per-lesson freeform notes. One note per (user, lesson) pair — subsequent `PUT` calls overwrite the existing note.

#### `GET /api/v1/lessons/:lessonId/notes`
**Auth**: Required

**Response** (`200`): `NoteResponseDto`.
```json
{
  "id": "clnote1",
  "lessonId": "cllesson1",
  "content": "Great explanation of closures here.",
  "createdAt": "2026-05-24T10:00:00.000Z",
  "updatedAt": "2026-05-24T10:15:00.000Z"
}
```

**Errors**: `404` note not found (user has not yet written a note for this lesson).

---

#### `PUT /api/v1/lessons/:lessonId/notes`
**Auth**: Required

Creates the note if it does not exist; updates it if it does (upsert).

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `content` | string | Yes | 1–10,000 characters |

**Response** (`200`): `NoteResponseDto`.

---

#### `DELETE /api/v1/lessons/:lessonId/notes`
**Auth**: Required

**Response** (`204`): No body.

**Errors**: `404` note not found.

---

### Bookmarks

Users can bookmark any lesson for quick retrieval later. One bookmark per (user, lesson) pair.

#### `GET /api/v1/bookmarks`
**Auth**: Required

**Query Parameters**: Pagination (`page`, `limit`).

**Response** (`200`): Paginated list of `BookmarkResponseDto`.
```json
{
  "id": "clbookmark1",
  "lessonId": "cllesson1",
  "lessonTitle": "Introduction to Variables",
  "lessonType": "VIDEO",
  "moduleId": "clmod1",
  "courseId": "clcourse1",
  "courseTitle": "TypeScript de Cero a Experto",
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```

---

#### `GET /api/v1/bookmarks/:lessonId/check`
**Auth**: Required

Check whether the current user has bookmarked a specific lesson — useful for toggling a bookmark icon without fetching the full list.

**Response** (`200`): `CheckBookmarkResponseDto`.
```json
{ "bookmarked": true }
```

---

#### `POST /api/v1/bookmarks`
**Auth**: Required

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `lessonId` | UUID | Yes | Lesson to bookmark |

**Response** (`201`): `BookmarkResponseDto`.

**Errors**: `409` lesson already bookmarked.

---

#### `DELETE /api/v1/bookmarks/:lessonId`
**Auth**: Required

**Response** (`204`): No body.

**Errors**: `404` bookmark not found.

---

### Certificates

Certificates are issued when a student completes a course. Each certificate has a unique `certificateCode` used for public verification and PDF download.

#### `POST /api/v1/certificates`
**Auth**: Required

Issues a certificate for a completed enrollment. Idempotent — if a certificate for this enrollment already exists, the existing record is returned (not duplicated).

**Request Body**:
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `enrollmentId` | UUID | Yes | Must belong to the caller and have `status: "COMPLETED"` |

**Response** (`201`): `CertificateResponseDto`.
```json
{
  "id": "clcert1",
  "certificateCode": "clxyz-unique-code",
  "userId": "cluser1",
  "courseId": "clcourse1",
  "enrollmentId": "clenroll1",
  "issuedAt": "2026-05-24T10:00:00.000Z",
  "finalGrade": 92.0,
  "course": {
    "title": "TypeScript de Cero a Experto",
    "slug": "typescript-de-cero-a-experto"
  },
  "instructor": {
    "firstName": "Luis",
    "lastName": "Quiroz"
  }
}
```

**Errors**: `403` enrollment does not belong to caller or course is not COMPLETED.

---

#### `GET /api/v1/certificates`
**Auth**: Required

**Response** (`200`): Array of `CertificateResponseDto` for the current user.

---

#### `GET /api/v1/certificates/:certificateCode`
**Auth**: None (`@Public`)

Retrieve certificate data for public display / verification. The `certificateCode` is the unique string from `CertificateResponseDto.certificateCode`.

**Response** (`200`): `CertificateResponseDto`.

**Errors**: `404` certificate not found.

---

#### `GET /api/v1/certificates/:certificateCode/download`
**Auth**: None (`@Public`)

Streams the certificate as a PDF file. Suitable for direct `<a href="...">` download links.

**Response** (`200`): Binary PDF stream.

| Response Header | Value |
|-----------------|-------|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="certificate-<code>.pdf"` |
| `Content-Length` | PDF byte count |

**Errors**: `404` certificate not found.

---

## 7. WebSocket Events

Authentication is required for both namespaces. Pass the access token in the Socket.io handshake:

```javascript
const socket = io('http://localhost:3000/forum', {
  auth: { token: 'eyJ...' }
  // Alternative: extraHeaders: { Authorization: 'Bearer eyJ...' }
});
```

If the token is missing, invalid, or revoked, the connection is immediately disconnected.

**WebSocket rate limit**: 20 events per 10 seconds per connection. Exceeding this disconnects the client.

---

### Namespace: `/forum`

Handles real-time forum thread updates.

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `joinThread` | `{ "threadId": "uuid" }` | Subscribe to live post updates for a thread. Access is checked (enrollment, forum settings). |
| `leaveThread` | `{ "threadId": "uuid" }` | Unsubscribe from thread updates. |

#### Server → Client Events

The forum gateway does not currently emit server-initiated events directly to clients. Post creation via `POST /api/v1/forum/threads/:threadId/posts` does not push live updates through the WebSocket — poll the REST endpoint or implement client-side optimistic updates. (The gateway is designed to be extended with `newPost` server events.)

---

### Namespace: `/messages`

Handles real-time private messaging.

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `sendMessage` | `{ "receiverId": "uuid", "content": "string (max 4000 chars)" }` | Send a message directly from the WebSocket. The message is saved and the receiver gets a `newMessage` event. |
| `markRead` | `{ "senderId": "uuid" }` | Mark all messages from `senderId` as read. The sender receives a `messagesRead` event. |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `newMessage` | `MessageResponseDto` | Emitted to a receiver when they receive a new message (from REST or WebSocket). |
| `messagesRead` | `{ "by": "userId" }` | Emitted to the sender when the receiver marks their messages as read. |

**Notes**: On connection, the server automatically joins the user to their private room (`user:{userId}`), so all `newMessage` and `messagesRead` events are delivered to all active sessions for that user.

---

## 8. File Uploads

| Endpoint | Max Size | Accepted Types | Rate Limit | Notes |
|----------|----------|----------------|------------|-------|
| `POST /upload/avatar` | 5 MB | jpg, png, webp | 10/min | Multipart form; returns CDN URL |
| `POST /upload/course-cover` | 5 MB | jpg, png, webp | 10/min | Multipart form; needs `courseId` field |
| `POST /upload/lesson-video` | No server limit | mp4, webm | 10/min | Returns presigned URL; upload directly to R2 |
| `POST /upload/assignment-file` | 50 MB | pdf, docx, zip, jpg, png | 3/min | Multipart form; returns CDN URL |

### Lesson Video Upload Flow

```
1. POST /api/v1/upload/lesson-video  { lessonId, contentType }
   → { uploadUrl, key, publicUrl }

2. PUT <uploadUrl>  (from the browser, not through the API)
   Content-Type: video/mp4  (or video/webm)
   Body: <video file bytes>

3. PATCH /api/v1/courses/:courseId/modules/:moduleId/lessons/:id
   { videoUrl: "<publicUrl from step 1>" }
```

---

## 9. Data Models

### Enums

```typescript
enum UserRole        { STUDENT | INSTRUCTOR | ADMIN }
enum CourseStatus    { DRAFT | PUBLISHED | ARCHIVED }
enum EnrollmentType  { FREE | ASSIGNED | CODE | PAID }
enum EnrollmentStatus { ACTIVE | COMPLETED | CANCELLED }
enum LessonType      { VIDEO | TEXT | QUIZ | ASSIGNMENT }
enum QuestionType    { MULTIPLE_CHOICE | SINGLE_CHOICE | TRUE_FALSE | SHORT_TEXT | LONG_TEXT }
enum GradingType     { AUTOMATIC | MANUAL }
enum RatingScale     { STARS_5 | NUMERIC_10 | NUMERIC_100 }
enum NotificationType { ENROLLMENT | NEW_LESSON | FORUM_REPLY | ASSIGNMENT_GRADED | QUIZ_PASSED | QUIZ_FAILED | COURSE_COMPLETED | ANNOUNCEMENT }
enum CalendarEventType { ASSIGNMENT_DUE | QUIZ_DUE | LESSON_AVAILABLE | COURSE_START | COURSE_END | CUSTOM }
enum GlobalAnnouncementType { INFO | WARNING | MAINTENANCE | SUCCESS }
```

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | Primary key |
| `email` | string | Unique |
| `firstName` | string | |
| `lastName` | string | |
| `avatarUrl` | string \| null | CDN URL |
| `roles` | UserRole[] | Default: `["STUDENT"]` |
| `isVerified` | boolean | Email verification status |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### Course

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `title` | string | |
| `slug` | string | Unique, auto-generated from title |
| `description` | string \| null | |
| `coverUrl` | string \| null | |
| `status` | CourseStatus | Default: `DRAFT` |
| `enrollmentType` | EnrollmentType | Default: `FREE`. Controls who can self-enroll. |
| `price` | number \| null | USD; `null` = free |
| `instructorId` | string | FK to User |
| `categoryId` | string \| null | FK to Category |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### CourseModule

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `courseId` | string | FK to Course |
| `title` | string | |
| `description` | string \| null | |
| `order` | integer | Unique per course |
| `isPublished` | boolean | Default: `false` |
| `unlockAfterDays` | integer \| null | Days after enrollment; `null` = immediate |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### Lesson

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `moduleId` | string | FK to CourseModule |
| `title` | string | |
| `order` | integer | Unique per module |
| `type` | LessonType | |
| `content` | string \| null | Rich text for TEXT lessons |
| `videoUrl` | string \| null | For VIDEO lessons |
| `duration` | integer \| null | Seconds |
| `isPreview` | boolean | |
| `isPublished` | boolean | |
| `rubricId` | string \| null | Linked rubric for grading |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### Enrollment

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `userId` | string | FK to User |
| `courseId` | string | FK to Course |
| `status` | EnrollmentStatus | Default: `ACTIVE` |
| `completedAt` | Date \| null | |
| `enrolledAt` | Date | |
| `updatedAt` | Date | |
| `finalGrade` | number \| null | Calculated weighted grade (0–100) |

### EnrollmentCode

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `courseId` | string | FK to Course |
| `code` | string | Unique across all courses |
| `maxUses` | integer \| null | `null` = unlimited |
| `usedCount` | integer | Incremented on each successful redemption |
| `expiresAt` | Date \| null | `null` = never expires |
| `isActive` | boolean | Set to `false` by soft-delete |
| `createdAt` | Date | |

---

### LessonProgress

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `enrollmentId` | string | FK to Enrollment |
| `lessonId` | string | FK to Lesson |
| `isLocked` | boolean | |
| `startedAt` | Date \| null | |
| `completedAt` | Date \| null | |
| `lastWatchedAt` | Date \| null | |
| `watchedSeconds` | integer \| null | |

### ForumThread

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `title` | string | |
| `courseId` | string \| null | `null` = global thread |
| `authorId` | string | FK to User |
| `isPinned` | boolean | |
| `isClosed` | boolean | |
| `createdAt` | Date | |
| `updatedAt` | Date | |

### ForumPost

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `threadId` | string | FK to ForumThread |
| `authorId` | string | FK to User |
| `content` | string | |
| `parentId` | string \| null | Self-referential; supports nested replies |
| `isAcceptedAnswer` | boolean | |
| `voteScore` | integer | Computed: sum of all votes |

### Message

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `senderId` | string | FK to User |
| `receiverId` | string | FK to User |
| `content` | string | |
| `readAt` | Date \| null | |
| `createdAt` | Date | |

### Notification

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `userId` | string | FK to User |
| `type` | NotificationType | |
| `title` | string | |
| `body` | string | |
| `isRead` | boolean | |
| `referenceId` | string \| null | ID of the related entity |
| `referenceType` | string \| null | e.g. `"thread"`, `"lesson"`, `"submission"` |
| `createdAt` | Date | |

### CalendarEvent

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (cuid) | |
| `courseId` | string \| null | `null` = personal event |
| `userId` | string | Creator FK to User |
| `title` | string | |
| `description` | string \| null | |
| `type` | CalendarEventType | |
| `startDate` | Date | |
| `endDate` | Date \| null | |
| `allDay` | boolean | |
| `color` | string \| null | Hex color code |
| `referenceId` | string \| null | Linked resource ID |
| `referenceType` | string \| null | `"lesson"`, `"assignment"`, `"quiz"`, `"module"` |

---

## 10. Security Notes for Frontend

### CORS

CORS is configured server-side via `CORS_ORIGINS` environment variable. Only origins in that list can make cross-origin requests. Development default: `http://localhost:3001`. Credentials are allowed (`credentials: true`).

### Token Handling

- **Never** store tokens in `localStorage` if XSS is a concern — use `sessionStorage` or in-memory storage.
- Implement a **request interceptor** that checks token expiry before each request and calls `POST /auth/refresh` proactively (before the 15-minute access token expires).
- On receiving a `401 Unauthorized`, attempt one refresh and retry the original request. If the refresh also returns `401`, log the user out.
- On refresh, **replace** stored tokens immediately — the old refresh token is revoked on use.

### Error Codes to Handle

| Code | When it occurs | Suggested action |
|------|----------------|------------------|
| `400` | Validation error | Display field-level errors from `message` |
| `401` | Token missing or expired | Attempt refresh; if fails, redirect to login |
| `403` | Wrong role or not owner | Show permission denied message; do not retry |
| `404` | Resource not found | Show not-found UI |
| `409` | Conflict (duplicate, full, completed) | Display conflict message to user |
| `422` | (not used) | — |
| `429` | Rate limited | Show "slow down" message; back off and retry |
| `503` | All backend services down | Show maintenance page |

### Security Headers

The API sets the following headers on all responses:

| Header | Value |
|--------|-------|
| `Cache-Control` | `no-store` (on auth endpoints) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| Helmet defaults | HSTS, X-Frame-Options, X-Content-Type-Options, etc. |

### Email Verification

Some operations require `isVerified: true` on the user account (e.g., enrolling in a course). After registration, call `POST /auth/send-verification` and then `POST /auth/verify-email` with the received code. Check `user.isVerified` in the auth response and prompt for verification accordingly.

### Request ID

You may send `X-Request-ID: <uuid>` on any request for distributed tracing. The server logs this header for correlation. It is not echoed back in the response.

### WebSocket Reconnection

When a WebSocket connection drops (network error, server restart), re-authenticate by establishing a new connection with a fresh access token. Do not attempt to reuse an old connection — the socket ID will have changed and the server will have cleaned up any room memberships.
