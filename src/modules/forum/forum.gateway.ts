import { Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../redis/redis.service';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.entity';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { JoinThreadWsDto } from './dto/join-thread-ws.dto';
import { ForumRepository } from './forum.repository';

const WS_RATE_LIMIT = 20;
const WS_RATE_WINDOW_SECS = 10;

@WebSocketGateway({ namespace: '/forum' })
export class ForumGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ForumGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
    private readonly forumRepository: ForumRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.authenticate(client);
    if (!user) {
      client.disconnect();
      return;
    }
    (client.data as Record<string, unknown>)['user'] = user;
    this.logger.log(`Forum client connected: ${client.id} (user: ${user.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Forum client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinThread')
  async handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ whitelist: true })) payload: JoinThreadWsDto,
  ): Promise<void> {
    if (!(await this.checkRateLimit(client))) {
      this.logger.warn(`Forum rate limit exceeded: ${client.id}`);
      client.disconnect();
      return;
    }
    const user = (client.data as Record<string, unknown>)['user'] as AuthenticatedUser;
    const hasAccess = await this.hasForumAccess(payload.threadId, user);
    if (hasAccess) void client.join(`thread:${payload.threadId}`);
  }

  @SubscribeMessage('leaveThread')
  async handleLeaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ whitelist: true })) payload: JoinThreadWsDto,
  ): Promise<void> {
    if (!(await this.checkRateLimit(client))) {
      this.logger.warn(`Forum rate limit exceeded: ${client.id}`);
      client.disconnect();
      return;
    }
    void client.leave(`thread:${payload.threadId}`);
  }

  private async hasForumAccess(threadId: string, user: AuthenticatedUser): Promise<boolean> {
    try {
      const thread = await this.forumRepository.findThreadById(threadId);
      if (!thread) return false;

      if (!thread.courseId) return true;

      const course = await this.forumRepository.findCourseForumSettings(thread.courseId);
      if (!course) return false;
      if (course.settings && !course.settings.forumEnabled) return false;
      if (course.settings?.forumPublic) return true;

      if (user.roles.includes(UserRole.ADMIN)) return true;
      if (course.instructorId === user.id) return true;

      return await this.enrollmentsService.isEnrolled(user.id, thread.courseId);
    } catch {
      return false;
    }
  }

  private async checkRateLimit(client: Socket): Promise<boolean> {
    const user = (client.data as Record<string, unknown>)['user'] as AuthenticatedUser | undefined;
    if (!user) return false;
    const key = `ratelimit:ws:${user.id}`;
    const count = await this.redisService.incr(key);
    if (count === 1) await this.redisService.expire(key, WS_RATE_WINDOW_SECS);
    return count <= WS_RATE_LIMIT;
  }

  private async authenticate(client: Socket): Promise<AuthenticatedUser | null> {
    const raw =
      (client.handshake.auth['token'] as string | undefined) ??
      client.handshake.headers['authorization']?.replace('Bearer ', '');

    if (!raw) {
      this.logger.warn(`Forum client rejected: ${client.id} — no token`);
      return null;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(raw, {
        secret: this.config.get('jwt.secret', { infer: true }),
      });
      if ((payload.type as string) !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }
      const revoked = await this.redisService.get(`revoked:user:${payload.sub}`);
      if (revoked) {
        this.logger.warn(`Forum client rejected: ${client.id} — revoked user ${payload.sub}`);
        return null;
      }
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        isVerified: payload.isVerified,
      };
    } catch {
      this.logger.warn(`Forum client rejected: ${client.id} — invalid token`);
      return null;
    }
  }
}
