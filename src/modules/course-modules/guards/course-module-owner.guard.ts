import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/auth.entity';
import { CoursesService } from '../../courses/courses.service';

@Injectable()
export class CourseModuleOwnerGuard implements CanActivate {
  constructor(private readonly coursesService: CoursesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    const courseId = request.params['courseId'] as string;

    if (user.roles.includes(UserRole.ADMIN)) return true;

    // coursesService.findOne throws NotFoundException if course does not exist
    const course = await this.coursesService.findOne(courseId);

    if (course.instructorId !== user.id) {
      throw new ForbiddenException('You do not own this course');
    }

    return true;
  }
}
