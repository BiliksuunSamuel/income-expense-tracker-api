import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({})
export class EventGatewayService {
  private readonly logger = new Logger(EventGatewayService.name);

  constructor() {}

  //
  @WebSocketServer() server: Server;

  //
  @SubscribeMessage('connection')
  async handleConnection(@ConnectedSocket() connection: Socket) {
    this.logger.log('new connection received', connection.id);
  }

  @SubscribeMessage('disconnected')
  async handleDisconnection(@ConnectedSocket() client: Socket) {
    this.logger.debug('socket  disconnected ', client.id);
  }

  //subscribe for sign in event
  @SubscribeMessage('signIn')
  async handleSignInEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any,
  ) {
    this.logger.debug('sign in event received', payload);
    client.emit('signIn', payload);
  }
}
