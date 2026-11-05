import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/chat-dto.js';
import { getAllowedOrigins } from '../config/cors.js';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import 'dotenv/config';

interface ChatSocket extends Socket {
  userId?: string;
  role?: string;
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Chat Gateway inicializado no namespace "/chat"');
  }

  async handleConnection(client: ChatSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Cliente ${client.id} tentou conectar sem token`);
        client.disconnect();
        return;
      }

      const decoded = this.decodeToken(token);
      if (!decoded) {
        this.logger.warn(`Cliente ${client.id} tentou conectar com token inválido`);
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.is_active) {
        this.logger.warn(`Cliente ${client.id} - usuário inválido ou inativo`);
        client.disconnect();
        return;
      }

      const storedToken = await this.redisService.client.get(`user:${decoded.userId}:token`);
      if (!storedToken || storedToken !== token) {
        this.logger.warn(`Cliente ${client.id} - token não encontrado no Redis ou inválido`);
        client.disconnect();
        return;
      }

      client.userId = decoded.userId;
      client.role = user.role;
      this.logger.log(`Cliente conectado: ${client.id} (userId: ${client.userId}, role: ${client.role})`);
    } catch (error) {
      this.logger.error(`Erro ao conectar cliente ${client.id}`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: ChatSocket) {
    this.logger.log(`Cliente desconectado: ${client.id} (userId: ${client.userId})`);
  }

  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: ChatSocket,
  ): Promise<void> {
    if (!client.userId || !client.role) {
      client.emit('error', { message: 'Não autenticado' });
      return;
    }

    this.logger.log(`Mensagem recebida de ${client.id} (userId: ${client.userId}): "${dto?.message}"`);

    try {
      for await (const text of this.chatService.streamChunks(dto, client.userId, client.role)) {
        client.emit('messageChunk', { text });
      }
      client.emit('messageComplete', { message: 'Stream complete' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Chat stream failed';
      this.logger.error(
        `Erro ao processar mensagem de ${client.id}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      client.emit('error', { message });
    }
  }

  private decodeToken(token: string): any {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET não configurado');
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      this.logger.error('Erro ao decodificar token', error);
      return null;
    }
  }
}