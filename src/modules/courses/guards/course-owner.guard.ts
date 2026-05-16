import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.entity';
import { CoursesRepository } from '../courses.repository';

@Injectable()
export class CourseOwnerGuard implements CanActivate {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    const courseId = request.params['id'] as string;

    if (user.role === UserRole.ADMIN) return true;

    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }

    return true;
  }
}
