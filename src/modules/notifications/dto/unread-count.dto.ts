import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountDto {
  @ApiProperty() count!: number;
}
