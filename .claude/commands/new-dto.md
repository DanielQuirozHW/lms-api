Create a fully validated DTO for **$ARGUMENTS**.

## Instructions

Parse the argument as: `<DtoName> [field:type ...]`

Examples:
- `CreateUserDto email:string name:string age:number role:enum`
- `UpdateCourseDto title:string? description:string? price:number?`

A trailing `?` means the field is optional.

## Output file

Place the file in the appropriate `dto/` folder based on context. If unclear, ask.

File name convention: `kebab-case.dto.ts` (e.g., `create-user.dto.ts`)

## Generated DTO structure

```typescript
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export class $DtoName {
  // Required string field
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fieldName!: string;

  // Optional string field
  @IsOptional()
  @IsString()
  @MinLength(1)
  optionalField?: string;

  // Email field
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase().trim())
  email!: string;

  // Number / integer field
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  count!: number;

  // Enum field (replace MyEnum with the actual enum)
  @IsEnum(MyEnum)
  role!: MyEnum;

  // Boolean field
  @IsBoolean()
  isActive!: boolean;

  // URL field
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
```

## Decorator selection guide

| Field type | Decorators to use |
|---|---|
| `string` (general) | `@IsString()`, `@MinLength()`, `@MaxLength()` |
| `string` (email) | `@IsEmail()`, `@Transform(lowercase+trim)` |
| `string` (URL) | `@IsUrl()` |
| `string` (UUID/ID) | `@IsUUID()` |
| `string` (password) | `@IsString()`, `@MinLength(8)`, `@Matches(regex)` |
| `number` (float) | `@IsNumber()`, `@Min()`, `@Max()`, `@Type(() => Number)` |
| `number` (integer) | `@IsInt()`, `@Min()`, `@Max()`, `@Type(() => Number)` |
| `boolean` | `@IsBoolean()`, `@Transform(toBoolean)` |
| `enum` | `@IsEnum(EnumName)` |
| `array` | `@IsArray()`, `@ArrayMinSize()`, plus item decorator via `@ValidateNested()` + `@Type()` |
| `nested object` | `@ValidateNested()`, `@Type(() => NestedDto)` |
| optional any | Prepend `@IsOptional()` |

## Rules

- Use `!` (definite assignment) for required fields, `?` for optional
- Always add `@Transform` to sanitize string inputs where relevant (trim whitespace, lowercase emails)
- Passwords: use `@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)` for complexity
- Never use `any` type
- Import only the decorators that are actually used
- After creating the file, confirm it is imported in the relevant module's controller or service
