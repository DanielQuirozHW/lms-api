import { Injectable } from '@nestjs/common';
import { CoursesRepository } from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(protected readonly coursesRepository: CoursesRepository) {}
}
