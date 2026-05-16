import { Injectable } from '@nestjs/common';
import { ForumRepository } from './forum.repository';

@Injectable()
export class ForumService {
  constructor(protected readonly forumRepository: ForumRepository) {}
}
