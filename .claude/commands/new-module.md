Generate a complete NestJS module for **$ARGUMENTS** following the patterns established in `src/modules/auth/` (the reference implementation).

Use kebab-case for the folder name and file names, PascalCase for class names. Create all files under `src/modules/<domain>/`.

---

## Files to create

### 1. `<domain>.entity.ts`

Re-export the Prisma model type. If the Prisma model does not exist yet, define a plain interface and add a `// TODO: replace with Prisma type after migration` comment.

```typescript
import type { Course } from '@prisma/client';
export type CourseEntity = Course;
```

---

### 2. `dto/create-<domain>.dto.ts`

All user-supplied fields must have class-validator decorators. Apply this type map without exception:

| Field type | Decorators |
|---|---|
| UUID (any FK or id) | `@IsUUID()` |
| String | `@IsString()` + `@MinLength(n)` |
| Email | `@IsEmail()` |
| Enum | `@IsEnum(TheEnum)` |
| Integer | `@IsInt()` + `@Min(0)` |
| URL | `@IsUrl()` |
| Boolean | `@IsBoolean()` |
| Optional | `@IsOptional()` first, then type decorator |

Never use `@IsString()` on a UUID field. Never leave a field without at least one decorator.

---

### 3. `dto/update-<domain>.dto.ts`

Always extend `PartialType`. Never copy-paste fields from the create DTO.

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { Create$ARGUMENTSDto } from './create-$ARGUMENTS.dto';
export class Update$ARGUMENTSDto extends PartialType(Create$ARGUMENTSDto) {}
```

---

### 4. `dto/<domain>-response.dto.ts`

Plain class with only the fields the API should return. Rules:
- Never include `passwordHash`, internal tokens, or raw IDs that expose implementation details
- Always include `id`, `createdAt`, `updatedAt`
- Use `@ApiProperty()` on every field (Swagger is configured globally)

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CourseResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] }) status!: CourseStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
```

---

### 5. `<domain>.repository.ts`

Inject `PrismaService` with **`private readonly`** (not `protected`). Return raw Prisma types — mapping to response DTOs is the service's responsibility.

```typescript
import { Injectable } from '@nestjs/common';
import type { Course, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindCoursesParams {
  status?: CourseStatus;
  skip?: number;
  take?: number;
}

@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: FindCoursesParams): Promise<[Course[], number]> {
    const where: Prisma.CourseWhereInput = {
      ...(params.status && { status: params.status }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.course.count({ where }),
    ]);
    return [data, total];
  }

  findById(id: string): Promise<Course | null> {
    return this.prisma.course.findUnique({ where: { id } });
  }

  create(data: Prisma.CourseCreateInput): Promise<Course> {
    return this.prisma.course.create({ data });
  }

  update(id: string, data: Prisma.CourseUpdateInput): Promise<Course> {
    return this.prisma.course.update({ where: { id }, data });
  }

  delete(id: string): Promise<Course> {
    return this.prisma.course.delete({ where: { id } });
  }
}
```

Repository rules:
- Never throw — return `null` on not-found; let the service throw `NotFoundException`
- Never contain business logic
- Every `findMany` must have a `take` parameter (from pagination or a hardcoded constant)
- `GlobalExceptionFilter` maps P2002→409, P2025→404, P2003→400 automatically

---

### 6. `<domain>.service.ts`

Inject the repository with **`private readonly`**. Map entities to response DTOs via a private `map()` method — never return raw Prisma objects. Throw NestJS HTTP exceptions.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate, PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import { CoursesRepository } from './courses.repository';
import { CourseResponseDto } from './dto/course-response.dto';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import type { Course } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<CourseResponseDto>> {
    const [courses, total] = await this.coursesRepository.findMany({
      skip: pagination.skip,
      take: pagination.limit,
    });
    return paginate(courses.map((c) => this.map(c)), total, pagination);
  }

  async findById(id: string): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.findById(id);
    if (!course) throw new NotFoundException('Course not found');
    return this.map(course);
  }

  async create(instructorId: string, dto: CreateCourseDto): Promise<CourseResponseDto> {
    const course = await this.coursesRepository.create({
      title: dto.title,
      slug: dto.title.toLowerCase().replace(/\s+/g, '-'),
      instructor: { connect: { id: instructorId } },
    });
    return this.map(course);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseResponseDto> {
    await this.findById(id); // 404 if not found before updating
    const course = await this.coursesRepository.update(id, dto);
    return this.map(course);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id); // 404 if not found before deleting
    await this.coursesRepository.delete(id);
  }

  private map(course: Course): CourseResponseDto {
    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
```

---

### 7. `<domain>.controller.ts`

Inject the service with **`private readonly`**. Apply `ParseUUIDPipe` on every UUID path param. Add `@HttpCode(HttpStatus.NO_CONTENT)` on DELETE. Apply `@Roles()` on every write endpoint.

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult, PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { CoursesService } from './courses.service';
import { CourseResponseDto } from './dto/course-response.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto): Promise<PaginatedResult<CourseResponseDto>> {
    return this.coursesService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CourseResponseDto> {
    return this.coursesService.findById(id);
  }

  @Post()
  @Roles('INSTRUCTOR', 'ADMIN')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles('INSTRUCTOR', 'ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ): Promise<CourseResponseDto> {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('INSTRUCTOR', 'ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coursesService.remove(id);
  }
}
```

---

### 8. `<domain>.module.ts`

Register service and repository in `providers`. Export only the service (repositories are internal). Import `JwtModule.register({})` only if the module includes a WebSocket gateway.

```typescript
import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService], // never export the repository
})
export class CoursesModule {}
```

---

### 9. `<domain>.service.spec.ts`

Mock the repository with `jest.fn()`. Test the service in isolation — no database, no Prisma.

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let repository: jest.Mocked<CoursesRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CoursesService,
        {
          provide: CoursesRepository,
          useValue: {
            findMany: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CoursesService);
    repository = module.get(CoursesRepository);
  });

  describe('findById', () => {
    it('throws NotFoundException when course does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('returns mapped response DTO when course exists', async () => {
      const mockCourse = { id: '1', title: 'Test', slug: 'test', status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() };
      repository.findById.mockResolvedValue(mockCourse as any);
      const result = await service.findById('1');
      expect(result.id).toBe('1');
      expect(result.title).toBe('Test');
    });
  });

  describe('create', () => {
    it('calls repository.create with correct data', async () => {
      const dto = { title: 'New Course' };
      const mockCourse = { id: '1', title: 'New Course', slug: 'new-course', status: 'DRAFT', createdAt: new Date(), updatedAt: new Date() };
      repository.create.mockResolvedValue(mockCourse as any);
      await service.create('instructor-id', dto as any);
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Course' }));
    });
  });
});
```

---

## After creating the files

1. Add `<Domain>Module` to `imports` in `src/app.module.ts`
2. If a new Prisma model is needed: update `prisma/schema.prisma`, run `pnpm prisma:migrate`, then `pnpm prisma:generate`
3. Run `pnpm build` — fix all TypeScript errors
4. Run `pnpm test` — all tests must pass
