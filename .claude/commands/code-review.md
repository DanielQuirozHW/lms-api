Review the code in **$ARGUMENTS** for quality, correctness, and maintainability.

Read the specified file(s) thoroughly, then evaluate each category below. For every issue found, include: **severity** (Critical / High / Medium / Low / Suggestion), **location** (file:line), **description**, and **recommended fix**.

---

## Review Categories

### 1. Correctness
- Logic errors or off-by-one mistakes
- Unhandled edge cases (empty arrays, null/undefined, zero values)
- Async errors not awaited or not caught
- Race conditions (parallel writes to the same resource)
- Incorrect HTTP status codes returned

### 2. TypeScript & Type Safety
- Use of `any` without justification
- Type assertions (`as SomeType`) that could hide runtime errors
- Non-null assertions (`!`) without a comment explaining why it's safe
- Missing return type annotations on exported functions and methods
- `unknown` values accessed without type narrowing

### 3. SOLID Principles
- **S** — Single Responsibility: does any class/function do more than one thing?
- **O** — Open/Closed: is logic hardcoded instead of extensible?
- **L** — Liskov: do subtypes behave as expected?
- **I** — Interface Segregation: are interfaces too fat?
- **D** — Dependency Inversion: are concrete classes injected instead of abstractions?

### 4. NestJS Conventions
- Controllers only orchestrate — no business logic inside a controller method
- Services contain business logic — no direct HTTP concerns (no `Request`/`Response` objects)
- Repository pattern respected — Prisma calls only in `*.repository.ts` files
- Module boundaries respected — no cross-module direct imports (use exported services)
- Circular dependency risks (A imports B, B imports A)
- Missing `@Injectable()`, `@Controller()`, or `@Module()` decorators

### 5. Performance
- N+1 queries (loop calling `prisma.findUnique` inside a `findMany` result)
- Missing `select` or `include` on Prisma queries (over-fetching)
- Unbounded `findMany` without pagination (`take`/`skip`)
- Synchronous heavy computation blocking the event loop
- Missing database indexes for frequently filtered columns
- Redis cache opportunities not taken for expensive reads

### 6. Security
- Unsanitised user input used in queries or file paths
- Sensitive data (passwords, tokens) returned in responses
- Missing guards on protected routes
- Raw Prisma queries built with string interpolation
- Missing input length limits (DoS via large payloads)

### 7. Error Handling
- Unhandled promise rejections
- Catching errors and swallowing them silently (`catch {}`)
- Leaking internal error details to the API consumer
- Missing `NotFoundException` when a resource isn't found
- Generic 500 errors instead of meaningful domain errors

### 8. Code Quality
- Functions longer than ~30 lines (consider splitting)
- Deep nesting (>3 levels) — consider early returns
- Magic numbers/strings without named constants
- Duplicated logic that could be extracted
- Misleading variable or method names
- Dead code (commented out, unreachable, unused exports)

### 9. Tests (if spec files are included)
- Tests that don't actually assert anything meaningful
- Mocks that don't reflect real behaviour (false confidence)
- Missing test cases for error paths
- Test names that don't describe the expected behaviour

---

## Output format

Group findings by category. For each issue:

```
[SEVERITY] file:line
Issue: <what is wrong>
Fix: <concrete recommendation or corrected code snippet>
```

End with a **summary**:
- Overall code quality rating: Excellent / Good / Needs Work / Poor
- Top 3 priority fixes
- What was done well (important for morale and learning)
