import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import { getAllowedOrigins } from '../config/cors.js';
import { TicketChatService } from './ticket-chat.service.js';
import { SendTicketChatMessageDto } from './dto/ticket-chat.dto.js';

interface TicketChatSocket extends Socket {
  userId?: string;
  role?: Role;
}

class JoinTicketDto {
  @IsUUID()
  ticketId: string;
}

class SendTicketMessageDto extends SendTicketChatMessageDto {
  @IsUUID()
  ticketId: string;
}

@WebSocketGateway({
  namespace: '/ticket-chat',
  cors: { origin: getAllowedOrigins(), credentials: true },
})
export class TicketChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TicketChatGateway.name);

  constructor(
    private readonly chatService: TicketChatService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: TicketChatSocket) {
    try {
      const authorization = client.handshake.headers.authorization;
      const token = client.handshake.auth?.token ?? authorization?.replace(/^Bearer\s+/i, '');
      if (typeof token !== 'string' || !token) return client.disconnect(true);

      const payload = await this.jwtService.verifyAsync<{ userId: string }>(token);
      if (!payload.userId) return client.disconnect(true);

      const [user, storedToken] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: payload.userId } }),
        this.redisService.client.get(`user:${payload.userId}:token`),
      ]);
      if (!user?.is_active || storedToken !== token) return client.disconnect(true);

      client.userId = user.id;
      client.role = user.role;
      client.data.userId = user.id;
      client.data.role = user.role;
    } catch (error) {
      this.logger.warn(`Conexão rejeitada (${client.id}): ${error instanceof Error ? error.message : 'token inválido'}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: TicketChatSocket) {
    this.logger.debug(`Cliente desconectado: ${client.id}`);
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @SubscribeMessage('joinTicket')
  async joinTicket(@MessageBody() dto: JoinTicketDto, @ConnectedSocket() client: TicketChatSocket) {
    if (!client.userId || !client.role) return this.emitError(client, 'Não autenticado');
    try {
      await this.chatService.assertCanAccessTicket(dto.ticketId, client.userId, client.role);
      await client.join(this.room(dto.ticketId));
      client.emit('joinedTicket', { ticketId: dto.ticketId });
    } catch (error) {
      this.emitError(client, this.errorMessage(error));
    }
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  @SubscribeMessage('sendMessage')
  async sendMessage(
    @MessageBody() payload: SendTicketMessageDto,
    @ConnectedSocket() client: TicketChatSocket,
  ) {
    if (!client.userId || !client.role) return this.emitError(client, 'Não autenticado');
    try {
      await this.chatService.assertCanAccessTicket(payload.ticketId, client.userId, client.role);
      const message = await this.chatService.sendMessage(
        payload.ticketId,
        { message: payload.message },
        client.userId,
        client.role,
      );
      await this.broadcastToAuthorizedMembers(payload.ticketId, message);
    } catch (error) {
      this.emitError(client, this.errorMessage(error));
    }
  }

  async broadcastMessage(ticketId: string, message: unknown) {
    try {
      await this.broadcastToAuthorizedMembers(ticketId, message);
    } catch (error) {
      this.logger.warn(
        `Falha ao transmitir mensagem do ticket ${ticketId}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  private room(ticketId: string) {
    return `ticket:${ticketId}`;
  }

  private async broadcastToAuthorizedMembers(ticketId: string, message: unknown) {
    const sockets = await this.server.in(this.room(ticketId)).fetchSockets();
    await Promise.all(
      sockets.map(async (socket) => {
        const member = socket.data as { userId?: string; role?: Role };
        if (!member.userId || !member.role) return;
        try {
          await this.chatService.assertCanAccessTicket(ticketId, member.userId, member.role);
          socket.emit('newMessage', message);
        } catch {
          await socket.leave(this.room(ticketId));
        }
      }),
    );
  }

  private emitError(client: TicketChatSocket, message: string) {
    client.emit('error', { message });
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Não foi possível processar a solicitação';
  }
}
