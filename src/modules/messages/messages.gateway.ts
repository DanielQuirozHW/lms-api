import { Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AppConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.entity';
import { MarkReadWsDto } from './dto/mark-read-ws.dto';
import { SendMessageWsDto } from './dto/send-message-ws.dto';
import { MessagesService } from './messages.service';

const WS_RATE_LIMIT = 20;
const WS_RATE_WINDOW_SECS = 10;

@WebSocketGateway({ namespace: '/messages' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
    private readonly messagesService: MessagesService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.authenticate(client);
    if (!user) {
      client.disconnect();
      return;
    }
    (client.data as Record<string, unknown>)['user'] = user;
    void client.join(`user:${user.id}`);
    this.logger.log(`Messages client connected: ${client.id} (user: ${user.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Messages client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ whitelist: true })) payload: SendMessageWsDto,
  ): Promise<void> {
    if (!(await this.checkRateLimit(client))) {
      this.logger.warn(`Messages rate limit exceeded: ${client.id}`);
      client.disconnect();
      return;
    }
    const user = (client.data as Record<string, unknown>)['user'] as AuthenticatedUser;
    const message = await this.messagesService.send(user.id, payload.receiverId, {
      content: payload.content,
    });
    this.emitToUser(payload.receiverId, 'newMessage', message);
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ whitelist: true })) payload: MarkReadWsDto,
  ): Promise<void> {
    if (!(await this.checkRateLimit(client))) {
      this.logger.warn(`Messages rate limit exceeded: ${client.id}`);
      client.disconnect();
      return;
    }
    const user = (client.data as Record<string, unknown>)['user'] as AuthenticatedUser;
    await this.messagesService.markConversationRead(user.id, payload.senderId);
    this.emitToUser(payload.senderId, 'messagesRead', { by: user.id });
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
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
      this.logger.warn(`Messages client rejected: ${client.id} — no token`);
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
        this.logger.warn(`Messages client rejected: ${client.id} — revoked user ${payload.sub}`);
        return null;
      }
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        isVerified: payload.isVerified,
      };
    } catch {
      this.logger.warn(`Messages client rejected: ${client.id} — invalid token`);
      return null;
    }
  }
}
