import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/chat-dto.js';
import { vi } from 'vitest';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: ChatService;

  const mockChatService = {
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(),
  };

  const mockRequest = {
    user: { userId: 'user-123', role: 'CLIENT' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get<ChatService>(ChatService);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    it('should call chat service with dto and user info', async () => {
      const dto: SendMessageDto = { message: 'Hello', history: [] };
      mockChatService.sendMessage.mockResolvedValue('AI response');

      const result = await controller.chat(dto, mockRequest);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
      expect(result).toEqual({ reply: 'AI response' });
    });

    it('should handle message with history', async () => {
      const dto: SendMessageDto = {
        message: 'Hello',
        history: [{ role: 'user', text: 'Hi' }],
      };
      mockChatService.sendMessage.mockResolvedValue('AI response');

      await controller.chat(dto, mockRequest);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
    });
  });

  describe('chatStream', () => {
    it('should return observable from chat service', () => {
      const dto: SendMessageDto = { message: 'Hello', history: [] };
      const mockObservable = { subscribe: vi.fn() };
      mockChatService.sendMessageStream.mockReturnValue(mockObservable);

      const result = controller.chatStream(dto, mockRequest);

      expect(mockChatService.sendMessageStream).toHaveBeenCalledWith(dto, 'user-123', 'CLIENT');
      expect(result).toBe(mockObservable);
    });
  });
});
