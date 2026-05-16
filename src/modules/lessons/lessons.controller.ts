import { Controller } from '@nestjs/common';
import { LessonsService } from './lessons.service';

@Controller('courses/:courseId/lessons')
export class LessonsController {
  constructor(protected readonly lessonsService: LessonsService) {}
}
