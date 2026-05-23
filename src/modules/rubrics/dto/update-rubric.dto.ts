import { PartialType, PickType } from '@nestjs/swagger';
import { CreateRubricDto } from './create-rubric.dto';

export class UpdateRubricDto extends PartialType(
  PickType(CreateRubricDto, ['title', 'description', 'totalPoints'] as const),
) {}
