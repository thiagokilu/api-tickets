import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import { vi } from 'vitest';
import { Server, Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: ChatService;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockServer = {
    emit: vi.fn(),
  } as unknown as Server;

  const mockClient = {
    id: 'test-client-id',
    handshake: {
      auth: {},
      headers: {},
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as Socket;

  const mockChatService = {
    streamChunks: vi.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockRedisService = {
    client: {
      get: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);

    gateway['server'] = mockServer;

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should disconnect client without token', async () => {
      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect client with invalid token', async () => {
      mockClient.handshake.auth.token = 'invalid-token';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should connect client with valid token', async () => {
      const validToken = 'valid.jwt.token';
      const payload = { userId: 'user-123', email: 'test@test.com' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const token = `header.${encodedPayload}.signature`;

      mockClient.handshake.auth.token = token;
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        is_active: true,
        role: 'CLIENT',
      });
      mockRedisService.client.get.mockResolvedValue(token);

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect((mockClient as any).userId).toBe('user-123');
    });

    it('should disconnect client with inactive user', async () => {
      const validToken = 'valid.jwt.token';
      const payload = { userId: 'user-123', email: 'test@test.com' };
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const token = `header.${encodedPayload}.signature`;

      mockClient.handshake.auth.token = token;
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        is_active: false,
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnect', () => {
      (mockClient as any).userId = 'user-123';
      const logSpy = vi.spyOn(gateway['logger'], 'log');

      gateway.handleDisconnect(mockClient);

      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('handleMessage', () => {
    it('should emit error if client not authenticated', async () => {
      const dto = { message: 'Hello' };
      (mockClient as any).userId = undefined;
      (mockClient as any).role = undefined;

      await gateway.handleMessage(dto, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Não autenticado' });
    });

    it('should stream chunks for authenticated client', async () => {
      const dto = { message: 'Hello' };
      (mockClient as any).userId = 'user-123';
      (mockClient as any).role = 'CLIENT';

      async function* mockStream() {
        yield 'chunk1';
        yield 'chunk2';
      }

      mockChatService.streamChunks.mockReturnValue(mockStream());

      await gateway.handleMessage(dto, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('messageChunk', { text: 'chunk1' });
      expect(mockClient.emit).toHaveBeenCalledWith('messageChunk', { text: 'chunk2' });
      expect(mockClient.emit).toHaveBeenCalledWith('messageComplete', { message: 'Stream complete' });
    });

    it('should emit error on stream failure', async () => {
      const dto = { message: 'Hello' };
      (mockClient as any).userId = 'user-123';
      (mockClient as any).role = 'CLIENT';

      mockChatService.streamChunks.mockImplementation(() => {
        throw new Error('Stream error');
      });

      await gateway.handleMessage(dto, mockClient);

      expect(mockClient.emit).toHaveBeenCalledWith('error', { message: 'Stream error' });
    });
  });
});
