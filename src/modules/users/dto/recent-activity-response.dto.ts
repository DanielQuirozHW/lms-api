import { ApiProperty } from '@nestjs/swagger';

export type RecentActivityType = 'LESSON_COMPLETED' | 'CERTIFICATE_EARNED' | 'LESSON_SAVED';

export class RecentActivityItemDto {
  @ApiProperty({
    enum: ['LESSON_COMPLETED', 'CERTIFICATE_EARNED', 'LESSON_SAVED'] as const,
    example: 'LESSON_COMPLETED',
  })
  type!: RecentActivityType;

  @ApiProperty({ example: 'Introduction to TypeScript' })
  title!: string;

  @ApiProperty({ example: 'TypeScript Basics' })
  subtitle!: string;

  @ApiProperty()
  date!: Date;
}
