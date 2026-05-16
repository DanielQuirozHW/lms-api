import { Injectable } from '@nestjs/common';
import { LessonsRepository } from './lessons.repository';

@Injectable()
export class LessonsService {
  constructor(protected readonly lessonsRepository: LessonsRepository) {}
}
