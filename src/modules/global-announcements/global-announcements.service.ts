import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, type GlobalAnnouncement } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.entity';
import type { CreateGlobalAnnouncementDto } from './dto/create-global-announcement.dto';
import type { GlobalAnnouncementResponseDto } from './dto/global-announcement-response.dto';
import type { UpdateGlobalAnnouncementDto } from './dto/update-global-announcement.dto';
import { GlobalAnnouncementsRepository } from './global-announcements.repository';

@Injectable()
export class GlobalAnnouncementsService {
  constructor(private readonly repo: GlobalAnnouncementsRepository) {}

  async findActive(): Promise<GlobalAnnouncementResponseDto[]> {
    const now = new Date();
    const announcements = await this.repo.findActive(now);
    return announcements.map((a) => this.map(a));
  }

  async create(
    dto: CreateGlobalAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<GlobalAnnouncementResponseDto> {
    const announcement = await this.repo.create({
      title: dto.title,
      message: dto.message,
      type: dto.type,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      author: { connect: { id: user.id } },
    });
    return this.map(announcement);
  }

  async update(
    id: string,
    dto: UpdateGlobalAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<GlobalAnnouncementResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Announcement not found');

    if (!user.roles.includes(UserRole.ADMIN) && existing.createdBy !== user.id) {
      throw new ForbiddenException('You do not own this announcement');
    }

    const updated = await this.repo.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.message !== undefined && { message: dto.message }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.startsAt !== undefined && { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }),
      ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
    });
    return this.map(updated);
  }

  async delete(id: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Announcement not found');

    if (!user.roles.includes(UserRole.ADMIN) && existing.createdBy !== user.id) {
      throw new ForbiddenException('You do not own this announcement');
    }

    await this.repo.delete(id);
  }

  private map(a: GlobalAnnouncement): GlobalAnnouncementResponseDto {
    return {
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.isActive,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
