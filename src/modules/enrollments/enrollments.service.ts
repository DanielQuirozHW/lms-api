import { Injectable } from '@nestjs/common';
import { EnrollmentsRepository } from './enrollments.repository';

@Injectable()
export class EnrollmentsService {
  constructor(protected readonly enrollmentsRepository: EnrollmentsRepository) {}
}
