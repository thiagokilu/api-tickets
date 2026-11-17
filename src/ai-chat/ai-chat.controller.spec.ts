import { Test, TestingModule } from '@nestjs/testing';
import { AiChatController } from './ai-chat.controller.js';
import { AiChatService } from './ai-chat.service.js';
import { SendAiAiChatMessageDto } from './dto/ai-chat.dto.js';
import { vi } from 'vitest';

describe('AiChatController', () => {
  let controller: AiChatController;
  let chatService: AiChatService;

  const mockAiChatService = {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
  };

  const mockRequest = {
    user: { userId: 'user-123', role: 'CLIENT' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiChatController],
      providers: [
        {
          provide: AiChatService,
          useValue: mockAiChatService,
        },
      ],
    }).compile();

    controller = module.get<AiChatController>(AiChatController);
    chatService = module.get<AiChatService>(AiChatService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    it('should call chat service with dto and user info', async () => {
      const dto: SendAiAiChatMessageDto = { message: 'Hello', history: [] };
      mockAiChatService.sendMessage.mockResolvedValue('AI response');

      const result = await controller.chat(dto, mockRequest);

      expect(mockAiChatService.sendMessage).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
      expect(result).toEqual({ reply: 'AI response' });
    });

    it('should handle message with history', async () => {
      const dto: SendAiAiChatMessageDto = {
        message: 'Hello',
        history: [{ role: 'user', text: 'Hi' }],
      };
      mockAiChatService.sendMessage.mockResolvedValue('AI response');

      await controller.chat(dto, mockRequest);

      expect(mockAiChatService.sendMessage).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
    });
  });

  describe('chatStream', () => {
    it('should return observable from chat service', () => {
      const dto: SendAiAiChatMessageDto = { message: 'Hello', history: [] };
      const mockObservable = { subscribe: vi.fn() };
      mockAiChatService.sendMessageStream.mockReturnValue(mockObservable);

      const result = controller.chatStream(dto, mockRequest);

      expect(mockAiChatService.sendMessageStream).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
      expect(result).toBe(mockObservable);
    });
  });
});
