import { Controller } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(protected readonly enrollmentsService: EnrollmentsService) {}
}
