Generate a complete NestJS module for **$ARGUMENTS**.

Before generating: read `MISTAKES.md` and `.claude/skills/nestjs-patterns.md`.

Use kebab-case for folder and file names, PascalCase for class names. Create all files under `src/modules/<domain>/`. Use the `auth` module as the reference implementation for patterns.

---

## Step-by-step checklist

Generate files in this exact order:

1. `<domain>.entity.ts`
2. `dto/create-<domain>.dto.ts`
3. `dto/update-<domain>.dto.ts`
4. `dto/<domain>-response.dto.ts`
5. `<domain>.repository.ts`
6. `<domain>.service.ts`
7. `<domain>.controller.ts`
8. `<domain>.module.ts`
9. `<domain>.service.spec.ts`

After all files are created: register in `app.module.ts`, run `pnpm build`, fix all errors.

---

## File 1: `<domain>.entity.ts`

Re-export the Prisma type. If the Prisma model does not exist yet, define a plain interface.

```typescript
import type { Course } from '@prisma/client';
export type CourseEntity = Course;
```

---

## File 2: `dto/create-<domain>.dto.ts`

All user-supplied fields must have class-validator decorators. Apply without exception:

| Field type | Required decorators |
|---|---|
| UUID / CUID (any FK) | `@IsUUID()` |
| Free-form string | `@IsString()` + `@MinLength(n)` |
| Email | `@IsEmail()` |
| Enum | `@IsEnum(TheEnum)` |
| Integer | `@IsInt()` + `@Min(0)` |
| Float | `@IsNumber()` |
| Boolean | `@IsBoolean()` |
| URL | `@IsUrl()` |
| Optional (any type) | `@IsOptional()` as first decorator, then type decorator |
| UUID array | `@IsArray()` + `@IsUUID('4', { each: true })` |

**Never** use `@IsString()` on a UUID/CUID field. **Never** include `id`, `createdAt`, `updatedAt`, `status`, or `role` in a create DTO.

```typescript
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';

export class CreateLessonDto {
  @ApiProperty({ example: 'Introduction to Variables' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ enum: LessonType })
  @IsEnum(LessonType)
  type!: LessonType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}
```

---

## File 3: `dto/update-<domain>.dto.ts`

Always extend `PartialType`. Import from `@nestjs/swagger` to inherit `@ApiProperty` decorators.

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateLessonDto } from './create-lesson.dto';

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
```

---

## File 4: `dto/<domain>-response.dto.ts`

Map only the fields the API should return. Always include `id`, `createdAt`, `updatedAt`. Never include `passwordHash`, internal tokens, or FK IDs that expose implementation details.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonType } from '@prisma/client';

export class LessonResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() moduleId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() order!: number;
  @ApiProperty({ enum: LessonType }) type!: LessonType;
  @ApiPropertyOptional() content!: string | null;
  @ApiPropertyOptional() videoUrl!: string | null;
  @ApiPropertyOptional() duration!: number | null;
  @ApiProperty() isPreview!: boolean;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
```

---

## File 5: `<domain>.repository.ts`

Inject `PrismaService` with `private readonly`. Return raw Prisma types — mapping to DTOs is the service's job. Never throw — return `null` on miss. Never accept raw DTOs as parameters.

```typescript
import { Injectable } from '@nestjs/common';
import type { Lesson, LessonResource, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FindLessonsParams {
  moduleId: string;
  publishedOnly?: boolean;
  skip?: number;
  take?: number;
}

@Injectable()
export class LessonsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(params: FindLessonsParams): Promise<[Lesson[], number]> {
    const where: Prisma.LessonWhereInput = {
      moduleId: params.moduleId,
      ...(params.publishedOnly && { isPublished: true }),
    };
    return this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        skip: params.skip,
        take: params.take ?? 100,
        orderBy: { order: 'asc' },
      }),
      this.prisma.lesson.count({ where }),
    ]);
  }

  // Always scope to parent — never findUnique by id alone for nested resources
  findByIdInModule(
    id: string,
    moduleId: string,
  ): Promise<(Lesson & { module: { courseId: string } }) | null> {
    return this.prisma.lesson.findFirst({
      where: { id, moduleId },
      include: { module: { select: { courseId: true } } },
    });
  }

  create(data: Prisma.LessonCreateInput): Promise<Lesson> {
    return this.prisma.lesson.create({ data });
  }

  update(id: string, data: Prisma.LessonUpdateInput): Promise<Lesson> {
    return this.prisma.lesson.update({ where: { id }, data });
  }

  delete(id: string): Promise<Lesson> {
    return this.prisma.lesson.delete({ where: { id } });
  }
}
```

---

## File 6: `<domain>.service.ts`

Inject the repository with `private readonly`. Map all Prisma entities through `private map()`. Throw NestJS HTTP exceptions — never raw `Error`. Verify ownership chain before every write.

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Lesson } from '@prisma/client';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { LessonResponseDto } from './dto/lesson-response.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(private readonly lessonsRepository: LessonsRepository) {}

  async create(courseId: string, moduleId: string, dto: CreateLessonDto): Promise<LessonResponseDto> {
    // Verify module belongs to this course before creating
    const module = await this.lessonsRepository.findModuleByCourseId(moduleId, courseId);
    if (!module) throw new NotFoundException('Module not found');
    const lesson = await this.lessonsRepository.create({
      title: dto.title,
      type: dto.type,
      order: dto.order ?? 1,
      module: { connect: { id: moduleId } },
    });
    return this.map(lesson);
  }

  async update(
    courseId: string,
    moduleId: string,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    // Full ownership chain verification
    const existing = await this.lessonsRepository.findByIdInModule(lessonId, moduleId);
    if (!existing || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
    const lesson = await this.lessonsRepository.update(lessonId, dto);
    return this.map(lesson);
  }

  async remove(courseId: string, moduleId: string, lessonId: string): Promise<void> {
    const existing = await this.lessonsRepository.findByIdInModule(lessonId, moduleId);
    if (!existing || existing.module.courseId !== courseId) {
      throw new NotFoundException('Lesson not found');
    }
    await this.lessonsRepository.delete(lessonId);
  }

  private map(lesson: Lesson): LessonResponseDto {
    return {
      id: lesson.id,
      moduleId: lesson.moduleId,
      title: lesson.title,
      order: lesson.order,
      type: lesson.type,
      content: lesson.content,
      videoUrl: lesson.videoUrl,
      duration: lesson.duration,
      isPreview: lesson.isPreview,
      isPublished: lesson.isPublished,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  }
}
```

---

## File 7: `<domain>.controller.ts`

Routing only. `ParseUUIDPipe` on every UUID param. `@Roles()` on every write. `@HttpCode(204)` on DELETE. Never re-fetch the user from DB — use `@CurrentUser()`.

```typescript
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/auth.entity';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonResponseDto } from './dto/lesson-response.dto';

@ApiTags('Lessons')
@ApiBearerAuth()
@Controller('courses/:courseId/modules/:moduleId/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a lesson in a module' })
  @ApiResponse({ status: 201, type: LessonResponseDto })
  create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.create(courseId, moduleId, dto);
  }

  @Patch(':lessonId')
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiResponse({ status: 200, type: LessonResponseDto })
  update(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonResponseDto> {
    return this.lessonsService.update(courseId, moduleId, lessonId, dto);
  }

  @Delete(':lessonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Delete a lesson' })
  @ApiResponse({ status: 204 })
  remove(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<void> {
    return this.lessonsService.remove(courseId, moduleId, lessonId);
  }
}
```

---

## File 8: `<domain>.module.ts`

Register service and repository in `providers`. Export only the service. Import `JwtModule.register({})` only if the module has a WebSocket gateway.

```typescript
import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, LessonsRepository],
  exports: [LessonsService],
})
export class LessonsModule {}
```

---

## File 9: `<domain>.service.spec.ts`

Mock the repository with `jest.fn()`. Test in isolation — no database, no Prisma.

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';

const mockLesson = {
  id: 'lesson-1',
  moduleId: 'module-1',
  title: 'Intro',
  order: 1,
  type: 'VIDEO',
  content: null,
  videoUrl: null,
  duration: null,
  isPreview: false,
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LessonsService', () => {
  let service: LessonsService;
  let repo: jest.Mocked<Pick<LessonsRepository, 'create' | 'findByIdInModule' | 'update' | 'delete' | 'findModuleByCourseId'>>;

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findByIdInModule: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findModuleByCourseId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LessonsService, { provide: LessonsRepository, useValue: repo }],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('throws NotFoundException when module does not belong to course', async () => {
      repo.findModuleByCourseId.mockResolvedValue(null);
      await expect(service.create('course-1', 'module-1', { title: 'Test', type: 'VIDEO' }))
        .rejects.toThrow(NotFoundException);
    });

    it('creates lesson when module belongs to course', async () => {
      repo.findModuleByCourseId.mockResolvedValue({ id: 'module-1' });
      repo.create.mockResolvedValue(mockLesson as any);
      const result = await service.create('course-1', 'module-1', { title: 'Test', type: 'VIDEO' });
      expect(result.id).toBe('lesson-1');
      expect(result).not.toHaveProperty('module');
    });
  });

  describe('update', () => {
    it('throws NotFoundException when lesson does not belong to module/course', async () => {
      repo.findByIdInModule.mockResolvedValue(null);
      await expect(service.update('course-1', 'module-1', 'lesson-1', { title: 'New' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when module belongs to different course', async () => {
      repo.findByIdInModule.mockResolvedValue({ ...mockLesson, module: { courseId: 'other-course' } } as any);
      await expect(service.update('course-1', 'module-1', 'lesson-1', { title: 'New' }))
        .rejects.toThrow(NotFoundException);
    });

    it('updates lesson when ownership chain is valid', async () => {
      repo.findByIdInModule.mockResolvedValue({ ...mockLesson, module: { courseId: 'course-1' } } as any);
      repo.update.mockResolvedValue({ ...mockLesson, title: 'New' } as any);
      const result = await service.update('course-1', 'module-1', 'lesson-1', { title: 'New' });
      expect(result.title).toBe('New');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when lesson does not exist', async () => {
      repo.findByIdInModule.mockResolvedValue(null);
      await expect(service.remove('course-1', 'module-1', 'lesson-1')).rejects.toThrow(NotFoundException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes lesson when ownership chain is valid', async () => {
      repo.findByIdInModule.mockResolvedValue({ ...mockLesson, module: { courseId: 'course-1' } } as any);
      repo.delete.mockResolvedValue(mockLesson as any);
      await service.remove('course-1', 'module-1', 'lesson-1');
      expect(repo.delete).toHaveBeenCalledWith('lesson-1');
    });
  });
});
```

---

## After creating all files

1. Add `<Domain>Module` to `imports` in `src/app.module.ts`
2. If a new Prisma model is needed: update `prisma/schema.prisma`, run `pnpm prisma:migrate`, then `pnpm prisma:generate`
3. Run `pnpm build` — fix all TypeScript errors
4. Run `pnpm test` — all tests must pass
5. Run `/post-generate-check src/modules/<domain>` to verify wiring
