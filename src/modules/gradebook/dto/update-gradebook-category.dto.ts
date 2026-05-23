import { PartialType } from '@nestjs/swagger';
import { CreateGradebookCategoryDto } from './create-gradebook-category.dto';

export class UpdateGradebookCategoryDto extends PartialType(CreateGradebookCategoryDto) {}
