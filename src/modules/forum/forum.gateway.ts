import { Logger } from '@nestjs/common';
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

@WebSocketGateway({ namespace: '/forum', cors: { origin: '*' } })
export class ForumGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ForumGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Forum client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Forum client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinThread')
  handleJoinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() threadId: string,
  ): void {
    void client.join(`thread:${threadId}`);
  }

  @SubscribeMessage('leaveThread')
  handleLeaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() threadId: string,
  ): void {
    void client.leave(`thread:${threadId}`);
  }
}
