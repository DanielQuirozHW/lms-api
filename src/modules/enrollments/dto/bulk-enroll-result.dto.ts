import { ApiProperty } from '@nestjs/swagger';

export class BulkEnrollResultDto {
  @ApiProperty({ example: 8, description: 'Users successfully enrolled' })
  enrolled!: number;

  @ApiProperty({ example: 2, description: 'Users already enrolled — skipped' })
  skipped!: number;

  @ApiProperty({ example: 0, description: 'Users not found or invalid' })
  failed!: number;
}
