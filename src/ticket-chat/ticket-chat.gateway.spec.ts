import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { RedisService } from '../services/redis.js';
import { TicketChatService } from './ticket-chat.service.js';
import { TicketChatGateway } from './ticket-chat.gateway.js';

describe('TicketChat TicketChatGateway', () => {
  const chatService = { assertCanAccessTicket: vi.fn(), sendMessage: vi.fn() };
  const jwtService = { verifyAsync: vi.fn() };
  const prisma = { user: { findUnique: vi.fn() } };
  const redis = { client: { get: vi.fn() } };
  let gateway: TicketChatGateway;
  const client: any = {
    id: 'socket-1', handshake: { auth: { token: 'jwt' }, headers: {} }, data: {},
    emit: vi.fn(), disconnect: vi.fn(), join: vi.fn(), leave: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TicketChatGateway,
        { provide: TicketChatService, useValue: chatService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    gateway = module.get(TicketChatGateway);
  });

  it('rejects an invalid JWT', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('connects only when the user is active and the token matches Redis', async () => {
    jwtService.verifyAsync.mockResolvedValue({ userId: 'client-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'client-1', is_active: true, role: Role.CLIENT });
    redis.client.get.mockResolvedValue('jwt');
    await gateway.handleConnection(client);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data).toEqual({ userId: 'client-1', role: Role.CLIENT });
  });

  it('authorizes a ticket before joining its room', async () => {
    client.userId = 'client-1';
    client.role = Role.CLIENT;
    chatService.assertCanAccessTicket.mockResolvedValue({ id: 'ticket-1' });
    await gateway.joinTicket({ ticketId: 'ticket-1' }, client);
    expect(chatService.assertCanAccessTicket).toHaveBeenCalledWith('ticket-1', 'client-1', Role.CLIENT);
    expect(client.join).toHaveBeenCalledWith('ticket:ticket-1');
    expect(client.emit).toHaveBeenCalledWith('joinedTicket', { ticketId: 'ticket-1' });
  });
});
