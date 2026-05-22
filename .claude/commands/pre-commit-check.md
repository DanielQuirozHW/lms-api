Run a pre-commit quality and security scan on **$ARGUMENTS** (defaults to all staged files if no argument given).

Read each file in the target scope, then evaluate every check below. Output each finding immediately as it is found. Do not wait until the end.

---

## Output format per finding

```
[BLOCK|WARN|PASS] CHECK-ID file:line — description
```

- **BLOCK** — must be fixed before committing; the commit should not proceed
- **WARN** — should be addressed but does not block the commit
- **PASS** — check passed (only print if explicitly noted below)

---

## Check 1 — Hardcoded secrets [BLOCK on any match]

Scan for patterns that indicate hardcoded credentials:

- String literals matching: `password`, `secret`, `token`, `apiKey`, `api_key`, `accessKey`, `privateKey` assigned to a literal value (not a variable reference or `config.get()`)
- Base64-encoded strings > 30 chars in non-test files
- Strings matching JWT format (`eyJ...`)
- Strings matching bcrypt hash format (`$2b$...`)
- Hex strings > 32 chars

```
[BLOCK] SECRET-001 src/modules/auth/auth.service.ts:12 — Hardcoded JWT secret 'my-secret-key'. Use ConfigService.get('jwt.secret')
```

---

## Check 2 — console.log usage [BLOCK in src/, PASS in test/]

Scan for `console.log`, `console.warn`, `console.error`, `console.debug` in `src/` files.

```
[BLOCK] LOG-001 src/modules/courses/courses.service.ts:34 — console.log found. Use: private readonly logger = new Logger(CoursesService.name)
```

---

## Check 3 — TypeScript `any` type [WARN]

Scan for `: any` and `as any` in non-test source files. Each occurrence must have a `// justification` comment.

```
[WARN] ANY-001 src/modules/forum/forum.gateway.ts:67 — Untyped 'any' usage. Add justification comment or replace with proper type.
```

---

## Check 4 — Direct PrismaService in Service classes [BLOCK]

Scan service files (`*.service.ts`) for `PrismaService` in the constructor parameter list.

```
[BLOCK] ARCH-001 src/modules/courses/courses.service.ts:8 — PrismaService injected directly in a Service. Inject CoursesRepository instead.
```

---

## Check 5 — Missing ParseUUIDPipe on UUID params [BLOCK]

Scan controller files for `@Param('` without `ParseUUIDPipe`. Flag any UUID-looking parameter name (ends in `Id`, named `id`) without the pipe.

```
[BLOCK] PIPE-001 src/modules/users/users.controller.ts:23 — @Param('userId') without ParseUUIDPipe. Use: @Param('userId', ParseUUIDPipe)
```

---

## Check 6 — TODO/FIXME without issue reference [WARN]

Scan for `TODO`, `FIXME`, `HACK`, `XXX` comments that do not include a ticket/issue reference (e.g., `TODO(#123)`, `FIXME: see LINEAR-456`).

```
[WARN] TODO-001 src/modules/enrollments/enrollments.service.ts:89 — TODO without issue reference. Add ticket number: TODO(#123)
```

---

## Check 7 — Bare `@Param` without pipe on write endpoints [BLOCK]

Scan POST/PATCH/PUT/DELETE handlers for `@Param` parameters without a validation pipe.

```
[BLOCK] PIPE-002 src/modules/lessons/lessons.controller.ts:45 — @Param('lessonId') on DELETE handler without ParseUUIDPipe
```

---

## Check 8 — Missing @HttpCode(204) on DELETE [WARN]

Scan `@Delete()` handlers for missing `@HttpCode(HttpStatus.NO_CONTENT)`.

```
[WARN] HTTP-001 src/modules/forum/forum.controller.ts:78 — @Delete handler missing @HttpCode(HttpStatus.NO_CONTENT). Returns 200 with null body instead of 204.
```

---

## Check 9 — @IsString() on UUID field [BLOCK]

Scan DTO files for `@IsString()` on fields whose name ends in `Id` or is named `id`.

```
[BLOCK] DTO-001 src/modules/courses/dto/create-course.dto.ts:14 — @IsString() on categoryId. Replace with @IsUUID().
```

---

## Check 10 — Exported repository from module [WARN]

Scan `*.module.ts` files for repository classes in the `exports` array.

```
[WARN] ARCH-002 src/modules/courses/courses.module.ts:9 — CoursesRepository in exports. Only export CoursesService; repositories are internal implementation details.
```

---

## Summary

After all checks, print:

```
--- Pre-commit check summary ---
BLOCK: N issues (commit should not proceed)
WARN:  N issues (review before merging)

BLOCKING issues:
  - [file:line] description
  ...

VERDICT: BLOCKED / CLEAN
```

If `BLOCKED`: do not proceed with the commit. Fix all BLOCK issues and re-run.
If `CLEAN` (zero BLOCK issues): safe to commit. Address WARN items in a follow-up.
