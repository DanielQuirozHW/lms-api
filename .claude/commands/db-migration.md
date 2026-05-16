Guide through creating and running a Prisma migration for: **$ARGUMENTS**

## Step 1 — Understand the change

Describe the schema change being made. Check `prisma/schema.prisma` and answer:
- What models are being added, modified, or deleted?
- Are any columns being made `NOT NULL`? If so, do existing rows have a default value?
- Are any unique constraints or indexes being added? Could they fail on existing data?
- Are any foreign keys being added? Is the referenced data guaranteed to exist?

## Step 2 — Safety assessment

Before proceeding, evaluate each risk:

| Risk | How to check |
|---|---|
| Adding a `NOT NULL` column to an existing table | Requires a default value OR a two-step migration |
| Renaming a column | Prisma treats this as drop + add — data is lost unless done manually |
| Dropping a column | Irreversible — confirm data is no longer needed |
| Changing a column type | May fail if existing values can't be cast |
| Adding a unique index | Will fail if duplicate values exist |
| Large table migration | Consider zero-downtime strategies (expand/contract pattern) |

**If any risk applies, explain it to the user and propose a safe approach before running any command.**

## Step 3 — Update the schema

Edit `prisma/schema.prisma` with the required changes. Follow project conventions:
- Table names: `@@map("snake_case")`
- Column names: `@map("snake_case")`
- IDs: `@id @default(cuid())`
- Timestamps: `createdAt DateTime @default(now()) @map("created_at")` and `updatedAt DateTime @updatedAt @map("updated_at")`

## Step 4 — Create the migration (development)

```bash
pnpm prisma:migrate
# When prompted, enter a descriptive name in snake_case:
# e.g.: add_category_to_courses
#        add_lesson_progress_table
#        make_course_price_nullable
```

Review the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` before confirming. Show the SQL to the user.

## Step 5 — Regenerate the Prisma client

```bash
pnpm prisma:generate
```

This is needed any time the schema changes, even without a migration (e.g., adding a `@relation`).

## Step 6 — Verify TypeScript

```bash
pnpm build
```

Fix any type errors caused by the schema change (new required fields in DTOs, service method signatures, etc.).

## Step 7 — Production deployment checklist

Before running `pnpm prisma:migrate:deploy` on production:

- [ ] Migration SQL reviewed and approved
- [ ] Database backup taken
- [ ] Migration tested on staging environment
- [ ] App deployment plan accounts for migration runtime (table locks on large tables)
- [ ] Rollback plan documented (see below)

## Rollback considerations

Prisma does not support automatic rollback of applied migrations. Rollback options:

1. **Restore from backup** — safest, requires recent backup
2. **Write a manual reverse migration** — create a new migration that undoes the change
3. **`prisma migrate resolve --rolled-back <migration-name>`** — marks the migration as rolled back in the `_prisma_migrations` table without running SQL (use when the migration failed mid-way)

Document the rollback SQL for this migration:
```sql
-- Reverse of this migration (fill in manually)
-- e.g.: ALTER TABLE courses DROP COLUMN IF EXISTS category_id;
```

## Common patterns

**Adding a nullable column (safe):**
```prisma
newField  String?  @map("new_field")
```

**Adding a NOT NULL column with default (safe):**
```prisma
status  CourseStatus  @default(DRAFT)  @map("status")
```

**Adding a NOT NULL column without default (requires two migrations):**
1. First migration: add column as nullable
2. Backfill data: `UPDATE table SET column = 'value' WHERE column IS NULL`
3. Second migration: add `NOT NULL` constraint
