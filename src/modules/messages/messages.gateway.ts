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

@WebSocketGateway({ namespace: '/messages', cors: { origin: '*' } })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Messages client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Messages client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @ConnectedSocket() _client: Socket,
    @MessageBody() _payload: { receiverId: string; content: string },
  ): void {
    // TODO: persist and broadcast
  }
}
