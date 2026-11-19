import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { TicketChatController } from './ticket-chat.controller.js';
import { TicketChatGateway } from './ticket-chat.gateway.js';
import { TicketChatService } from './ticket-chat.service.js';

describe('TicketChat TicketChatController', () => {
  const service = { getMessages: vi.fn(), sendMessage: vi.fn() };
  const gateway = { broadcastMessage: vi.fn() };
  let controller: TicketChatController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TicketChatController],
      providers: [
        { provide: TicketChatService, useValue: service },
        { provide: TicketChatGateway, useValue: gateway },
      ],
    }).compile();
    controller = module.get(TicketChatController);
  });

  it('delegates listing to ticket chat service with identity from JWT', async () => {
    const result = [];
    service.getMessages.mockResolvedValue(result);
    await expect(controller.getMessages('ticket-1', { user: { userId: 'client-1', role: 'CLIENT' } })).resolves.toBe(result);
    expect(service.getMessages).toHaveBeenCalledWith('ticket-1', 'client-1', 'CLIENT');
  });

  it('delegates sending to ticket chat service with the authenticated sender', async () => {
    const dto = { message: 'Oi' };
    const message = { id: 'message-1' };
    service.sendMessage.mockResolvedValue(message);
    await expect(controller.sendMessage('ticket-1', dto, { user: { userId: 'client-1', role: 'CLIENT' } })).resolves.toBe(message);
    expect(service.sendMessage).toHaveBeenCalledWith('ticket-1', dto, 'client-1', 'CLIENT');
    expect(gateway.broadcastMessage).toHaveBeenCalledWith('ticket-1', message);
  });
});
