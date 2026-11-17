import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { TicketChatService } from './ticket-chat.service.js';

describe('TicketChat TicketChatService', () => {
  let service: TicketChatService;
  const tx = {
    ticketMessage: { create: vi.fn() },
    ticketHistory: { create: vi.fn() },
  };
  const prisma = {
    tickets: { findUnique: vi.fn() },
    ticketMessage: { findMany: vi.fn() },
    $transaction: vi.fn((callback) => callback(tx)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [TicketChatService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TicketChatService);
  });

  it('lists messages oldest first with user email', async () => {
    prisma.tickets.findUnique.mockResolvedValue({ id: 'ticket-1', requester_id: 'client-1' });
    prisma.ticketMessage.findMany.mockResolvedValue([]);

    await service.getMessages('ticket-1', 'client-1', Role.CLIENT);

    expect(prisma.ticketMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticket_id: 'ticket-1' },
      orderBy: { created_at: 'asc' },
      include: { user: { select: { id: true, username: true, email: true, role: true } } },
    }));
  });

  it('stores the message and its history entry in one transaction', async () => {
    prisma.tickets.findUnique.mockResolvedValue({ id: 'ticket-1', requester_id: 'client-1' });
    tx.ticketMessage.create.mockResolvedValue({ id: 'message-1', content: 'Oi' });

    await service.sendMessage('ticket-1', { message: 'Oi' }, 'client-1', Role.CLIENT);

    expect(tx.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { ticket_id: 'ticket-1', user_id: 'client-1', content: 'Oi', attachments: [] },
      include: { user: { select: { id: true, username: true, email: true, role: true } } },
    }));
    expect(tx.ticketHistory.create).toHaveBeenCalledWith({ data: {
      ticket_id: 'ticket-1', actor_id: 'client-1', field_name: 'message_added',
      old_value: null, new_value: 'message-1',
    } });
  });

  it('rejects a client who does not own the ticket', async () => {
    prisma.tickets.findUnique.mockResolvedValue({ id: 'ticket-1', requester_id: 'someone-else' });
    await expect(service.getMessages('ticket-1', 'client-1', Role.CLIENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for an unknown ticket', async () => {
    prisma.tickets.findUnique.mockResolvedValue(null);
    await expect(service.getMessages('missing', 'client-1', Role.CLIENT)).rejects.toBeInstanceOf(NotFoundException);
  });
});
