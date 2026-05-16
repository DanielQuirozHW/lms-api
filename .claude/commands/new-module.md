Generate a complete NestJS module for **$ARGUMENTS** following this project's domain-driven design conventions.

## What to create

Create all files under `src/modules/$ARGUMENTS/` (use kebab-case for the folder name, PascalCase for class names).

### 1. Entity type — `$ARGUMENTS.entity.ts`

A plain TypeScript interface or type that mirrors the Prisma model. Example:
```typescript
import type { $ARGUMENTS as Prisma$ARGUMENTS } from '@prisma/client';
export type $ARGUMENTSEntity = Prisma$ARGUMENTS;
```
If the Prisma model doesn't exist yet, define a plain interface with the expected fields and add a TODO comment.

### 2. DTOs — `dto/`

**`dto/create-$ARGUMENTS.dto.ts`**
- All required fields with `class-validator` decorators
- Use `@IsString()`, `@IsEmail()`, `@IsEnum()`, `@IsOptional()`, `@MinLength()`, `@IsInt()`, `@Min()`, `@IsUrl()` as appropriate
- Every field must have at least one decorator

**`dto/update-$ARGUMENTS.dto.ts`**
```typescript
import { PartialType } from '@nestjs/mapped-types';
import { Create$ARGUMENTSDto } from './create-$ARGUMENTS.dto';
export class Update$ARGUMENTSDto extends PartialType(Create$ARGUMENTSDto) {}
```

**`dto/response-$ARGUMENTS.dto.ts`**
- Plain class with `readonly` fields — what the API returns
- Never include `passwordHash` or other sensitive fields
- Include `id`, `createdAt`, `updatedAt` and all public fields

### 3. Repository — `$ARGUMENTS.repository.ts`

Encapsulates all Prisma calls for this domain. Injected by the service.
```typescript
@Injectable()
export class $ARGUMENTSRepository {
  constructor(protected readonly prisma: PrismaService) {}

  async findById(id: string): Promise<$ARGUMENTSEntity | null> {
    return this.prisma.$ARGUMENTS_LOWER.findUnique({ where: { id } });
  }

  async findAll(skip: number, take: number): Promise<[$ARGUMENTSEntity[], number]> {
    return this.prisma.$transaction([
      this.prisma.$ARGUMENTS_LOWER.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.$ARGUMENTS_LOWER.count(),
    ]);
  }

  async create(data: Create$ARGUMENTSDto): Promise<$ARGUMENTSEntity> {
    return this.prisma.$ARGUMENTS_LOWER.create({ data });
  }

  async update(id: string, data: Update$ARGUMENTSDto): Promise<$ARGUMENTSEntity> {
    return this.prisma.$ARGUMENTS_LOWER.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$ARGUMENTS_LOWER.delete({ where: { id } });
  }
}
```

### 4. Service — `$ARGUMENTS.service.ts`

Business logic layer. Uses the repository, never calls Prisma directly.
- `findAll(pagination: PaginationDto)` → `PaginatedResult<Response$ARGUMENTSDto>`
- `findById(id: string)` → `Response$ARGUMENTSDto` (throw `NotFoundException` if not found)
- `create(dto: Create$ARGUMENTSDto)` → `Response$ARGUMENTSDto`
- `update(id: string, dto: Update$ARGUMENTSDto)` → `Response$ARGUMENTSDto`
- `remove(id: string)` → `void`

Use `private map(entity: $ARGUMENTSEntity): Response$ARGUMENTSDto` to convert entities to response DTOs — never return raw Prisma objects.

### 5. Controller — `$ARGUMENTS.controller.ts`

REST endpoints with proper decorators:
- `GET    /` → `findAll` — `@Get()`, `@HttpCode(200)`, `@Query() pagination: PaginationDto`
- `GET    /:id` → `findById` — `@Get(':id')`, `@Param('id') id: string`
- `POST   /` → `create` — `@Post()`, `@HttpCode(201)`, `@Body() dto: Create$ARGUMENTSDto`
- `PATCH  /:id` → `update` — `@Patch(':id')`, `@Body() dto: Update$ARGUMENTSDto`
- `DELETE /:id` → `remove` — `@Delete(':id')`, `@HttpCode(204)`

All methods must declare explicit return types. Use `@Controller('$ARGUMENTS_LOWER_PLURAL')`.

### 6. Module — `$ARGUMENTS.module.ts`

```typescript
@Module({
  controllers: [$ARGUMENTSController],
  providers: [$ARGUMENTSService, $ARGUMENTSRepository],
  exports: [$ARGUMENTSService],
})
export class $ARGUMENTSModule {}
```

### 7. Unit tests — `$ARGUMENTS.service.spec.ts`

Test the service in isolation using `jest.fn()` mocks for the repository.

```typescript
describe('$ARGUMENTSService', () => {
  let service: $ARGUMENTSService;
  let repository: jest.Mocked<$ARGUMENTSRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        $ARGUMENTSService,
        {
          provide: $ARGUMENTSRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get($ARGUMENTSService);
    repository = module.get($ARGUMENTSRepository);
  });

  // Write: findById throws NotFoundException when not found
  // Write: create calls repository.create with correct data
  // Write: findAll returns paginated result
});
```

## After creating the files

1. Add `$ARGUMENTSModule` to the imports array in `src/app.module.ts`
2. If a new Prisma model is needed, add it to `prisma/schema.prisma` and remind the user to run `pnpm prisma:migrate`
3. Run `pnpm build` to confirm no TypeScript errors
