import { Injectable } from '@nestjs/common';
import { type GlobalAnnouncement, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GlobalAnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(now: Date): Promise<GlobalAnnouncement[]> {
    return this.prisma.globalAnnouncement.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  create(data: Prisma.GlobalAnnouncementCreateInput): Promise<GlobalAnnouncement> {
    return this.prisma.globalAnnouncement.create({ data });
  }

  findById(id: string): Promise<GlobalAnnouncement | null> {
    return this.prisma.globalAnnouncement.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.GlobalAnnouncementUpdateInput): Promise<GlobalAnnouncement> {
    return this.prisma.globalAnnouncement.update({ where: { id }, data });
  }

  delete(id: string): Promise<GlobalAnnouncement> {
    return this.prisma.globalAnnouncement.delete({ where: { id } });
  }
}
