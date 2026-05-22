Verify that all generated files in **$ARGUMENTS** are correctly wired and complete.

Run this after `/new-module` or after generating any service, controller, DTO, or gateway file. This check catches the most common integration mistakes before `pnpm build` reveals them.

---

## Output format

```
[PASS|FAIL|MANUAL] CHECK-ID — description
```

- **PASS** — check passed automatically
- **FAIL** — automated check found a problem; fix it now
- **MANUAL** — cannot be verified automatically; describes what to check by hand

---

## Check 1 — Module registered in AppModule [FAIL if missing]

Read `src/app.module.ts`. Verify the new module class is present in the `imports` array.

```
[FAIL] REG-001 — LessonsModule not found in src/app.module.ts imports array.
Fix: Add LessonsModule to imports in app.module.ts and add the corresponding import statement.
```

---

## Check 2 — Service and repository registered in domain module [FAIL if missing]

Read `src/modules/<domain>/<domain>.module.ts`. Verify:
- Service class is in `providers`
- Repository class is in `providers`
- Only the service class (not the repository) is in `exports`

```
[FAIL] MOD-001 — LessonsRepository not found in LessonsModule providers.
[FAIL] MOD-002 — LessonsRepository found in LessonsModule exports. Repositories must not be exported.
```

---

## Check 3 — Controller registered in domain module [FAIL if missing]

Verify the controller is in the `controllers` array of its module.

```
[FAIL] MOD-003 — LessonsController not found in LessonsModule controllers.
```

---

## Check 4 — All DTOs have @ApiProperty decorators [FAIL if missing]

Read all `dto/*.dto.ts` files in the module. Every public field must have `@ApiProperty()` or `@ApiPropertyOptional()`.

```
[FAIL] DTO-001 — LessonResponseDto.videoUrl is missing @ApiPropertyOptional() decorator.
```

---

## Check 5 — All controller endpoints have @ApiOperation and @ApiResponse [FAIL if missing]

Read the controller file. Every method decorated with `@Get`, `@Post`, `@Patch`, `@Put`, or `@Delete` must have:
- `@ApiOperation({ summary: '...' })`
- At least one `@ApiResponse({ status: N, ... })`

```
[FAIL] SWAGGER-001 — LessonsController.remove is missing @ApiOperation decorator.
[FAIL] SWAGGER-002 — LessonsController.create is missing @ApiResponse decorator.
```

---

## Check 6 — No direct PrismaService usage in service files [FAIL if found]

Read `<domain>.service.ts`. Verify `PrismaService` does not appear in the constructor parameters or as an injected dependency.

```
[FAIL] ARCH-001 — LessonsService constructor injects PrismaService directly. Inject LessonsRepository instead.
```

---

## Check 7 — All UUID path params use ParseUUIDPipe [FAIL if missing]

Read the controller. Every `@Param` for an ID field must include `ParseUUIDPipe`.

```
[FAIL] PIPE-001 — LessonsController.update @Param('lessonId') missing ParseUUIDPipe.
```

---

## Check 8 — DELETE endpoints have @HttpCode(NO_CONTENT) [FAIL if missing]

Read the controller. Every `@Delete` handler must have `@HttpCode(HttpStatus.NO_CONTENT)`.

```
[FAIL] HTTP-001 — LessonsController.remove missing @HttpCode(HttpStatus.NO_CONTENT).
```

---

## Check 9 — Update DTO uses PartialType [FAIL if not]

Read `dto/update-<domain>.dto.ts`. It must extend `PartialType(Create<Domain>Dto)`. Flag any DTO that manually redeclares fields as optional.

```
[FAIL] DTO-002 — UpdateLessonDto does not extend PartialType(CreateLessonDto). Manual optional fields lose @ApiProperty decorators.
```

---

## Check 10 — Spec file exists and covers error paths [MANUAL if missing]

Verify `<domain>.service.spec.ts` exists and contains at least one test asserting `NotFoundException` for a not-found scenario.

```
[FAIL] TEST-001 — No spec file found at src/modules/lessons/lessons.service.spec.ts
[MANUAL] TEST-002 — Spec file exists but verify it covers: NotFoundException on not-found, ownership chain rejection (BOLA), and 409 on conflict where applicable.
```

---

## Check 11 — JwtModule imported if gateway exists [FAIL if missing]

If a `<domain>.gateway.ts` file exists in the module, verify `JwtModule.register({})` is in the module's `imports` array.

```
[FAIL] WS-001 — ForumGateway exists but JwtModule not found in ForumModule imports.
```

---

## Summary

After all checks, print:

```
--- Post-generate check summary ---
FAIL:   N issues (must fix before pnpm build)
MANUAL: N items (verify by hand)

FAILING checks:
  - [CHECK-ID] description
  ...

NEXT STEPS:
  1. Fix all FAIL items above
  2. Manually verify MANUAL items
  3. Run: pnpm build
  4. Run: pnpm test
```
