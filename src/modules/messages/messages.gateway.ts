import { Logger } from '@nestjs/common';
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
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.entity';

@WebSocketGateway({ namespace: '/messages' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  handleConnection(client: Socket): void {
    const user = this.authenticate(client);
    if (!user) {
      client.disconnect();
      return;
    }
    (client.data as Record<string, unknown>)['user'] = user;
    this.logger.log(`Messages client connected: ${client.id} (user: ${user.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Messages client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() _payload: { receiverId: string; content: string },
  ): void {}

  private authenticate(client: Socket): AuthenticatedUser | null {
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
      return { id: payload.sub, email: payload.email, roles: payload.roles };
    } catch {
      this.logger.warn(`Messages client rejected: ${client.id} — invalid token`);
      return null;
    }
  }
}
