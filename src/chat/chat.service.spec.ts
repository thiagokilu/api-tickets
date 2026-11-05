import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../services/prisma.js';
import { vi } from 'vitest';
import { ChatOpenAI } from '@langchain/openai';

vi.mock('@langchain/openai');

describe('ChatService', () => {
  let service: ChatService;
  let configService: ConfigService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    tickets: {
      findMany: vi.fn(),
    },
  };

  const mockConfigService = {
    get: () => 'mock-api-key',
    getOrThrow: (key: string) =>
      key === 'NVIDIA_MODEL'
        ? 'z-ai/glm-5.3-flash'
        : key === 'NVIDIA_BASE_URL'
          ? 'https://integrate.api.nvidia.com/v1'
          : 'mock-api-key',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTicketsContext', () => {
    it('should return no tickets message for client with no tickets', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      const result = await service['getTicketsContext']('user-123', 'CLIENT');

      expect(result).toBe('Você não possui tickets abertos ou em andamento no momento.');
    });

    it('should return no tickets message for agent with no tickets', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      const result = await service['getTicketsContext']('user-123', 'AGENT');

      expect(result).toBe('Não há tickets abertos ou em andamento no momento.');
    });

    it('should return tickets formatted as text', async () => {
      const mockTickets = [
        {
          id: 1,
          title: 'Test Ticket',
          description: 'Test Description',
          status: 'OPEN',
          priority: 'HIGH',
          requester: { username: 'testuser', email: 'test@test.com' },
          assigned_to: { username: 'agent' },
          category: { name: 'Technical' },
          created_at: new Date('2024-01-01'),
        },
      ];

      mockPrismaService.tickets.findMany.mockResolvedValue(mockTickets);

      const result = await service['getTicketsContext']('user-123', 'CLIENT');

      expect(result).toContain('Tickets disponíveis');
      expect(result).toContain('ID: 1');
      expect(result).toContain('Test Ticket');
    });

    it('should filter by requester_id for CLIENT role', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      await service['getTicketsContext']('user-123', 'CLIENT');

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requester_id: 'user-123',
          }),
        }),
      );
    });

    it('should not filter by requester_id for AGENT role', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      await service['getTicketsContext']('user-123', 'AGENT');

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            requester_id: 'user-123',
          }),
        }),
      );
    });
  });

  describe('sendMessage', () => {
    it('should call AI model with built messages', async () => {
      const dto = { message: 'Hello', history: [] };
      const mockResponse = { content: 'AI response' };

      vi.spyOn(service['langchainAi'], 'invoke').mockResolvedValue(mockResponse);
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      const result = await service.sendMessage(dto, 'user-123', 'CLIENT');

      expect(result).toBe('AI response');
      expect(service['langchainAi'].invoke).toHaveBeenCalled();
    });
  });

  describe('streamChunks', () => {
    it('should yield chunks from AI stream', async () => {
      const dto = { message: 'Hello', history: [] };
      const chunks = [];

      async function* mockStream() {
        yield { content: 'chunk1' };
        yield { content: 'chunk2' };
      }

      vi.spyOn(service['langchainAi'], 'stream').mockResolvedValue(mockStream());
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      for await (const chunk of service.streamChunks(dto, 'user-123', 'CLIENT')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['chunk1', 'chunk2']);
    });
  });

  describe('describeRequest', () => {
    it('should describe request correctly', () => {
      const dto = { message: 'Hello', history: [] };
      const result = service['describeRequest'](dto);

      expect(result).toBe('5 caracteres, 0 mensagens no histórico');
    });

    it('should handle history', () => {
      const dto = { message: 'Hello', history: [{ role: 'user', text: 'Hi' }] };
      const result = service['describeRequest'](dto);

      expect(result).toBe('5 caracteres, 1 mensagens no histórico');
    });
  });
});
