import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service.js';
import { PrismaService } from '../services/prisma.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { vi } from 'vitest';

describe('TicketsService', () => {
  let service: TicketsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $transaction: vi.fn(async (callback) => callback(mockPrismaService)),
    tickets: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ticketHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create new tickets with OPEN status', async () => {
      const ticket = {
        id: '1',
        title: 'Test Ticket',
        description: 'Test Description',
        status: 'OPEN',
        priority: null,
        requester_id: 'user1',
        category_id: null,
      };

      mockPrismaService.tickets.create.mockResolvedValue(ticket);
      mockPrismaService.ticketHistory.create.mockResolvedValue({});

      const result = await service.create(
        {
          title: ticket.title,
          description: ticket.description,
        },
        'user1',
      );

      expect(result).toEqual(ticket);
      expect(mockPrismaService.tickets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: ticket.title,
            description: ticket.description,
            status: 'OPEN',
            priority: null,
            requester_id: 'user1',
            category_id: undefined,
            client_files: [],
          },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should apply optional filters', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);

      await service.findAll('adminId', Role.ADMIN, {
        status: 'OPEN' as const,
        priority: 'HIGH' as const,
        category_id: '3' as unknown as number,
      });

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'OPEN',
            priority: 'HIGH',
            category_id: 3,
          },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should allow ADMIN to delete any ticket', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'user1' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.tickets.delete.mockResolvedValue(mockTicket);

      const result = await service.remove('1', 'adminId', Role.ADMIN);

      expect(result).toEqual(mockTicket);
      expect(mockPrismaService.tickets.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should allow AGENT to delete their own ticket', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'agent1' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.tickets.delete.mockResolvedValue(mockTicket);

      const result = await service.remove('1', 'agent1', Role.AGENT);

      expect(result).toEqual(mockTicket);
      expect(mockPrismaService.tickets.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should forbid AGENT from deleting others tickets', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'otherUser' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);

      await expect(service.remove('1', 'agent1', Role.AGENT)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('1', 'agent1', Role.AGENT)).rejects.toThrow(
        'You can only delete your own tickets',
      );
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue(null);

      await expect(service.remove('1', 'user1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('1', 'user1', Role.ADMIN)).rejects.toThrow(
        'Ticket not found',
      );
    });
  });

  describe('getHistory', () => {
    it('should allow ADMIN to get history of any ticket', async () => {
      const mockTicket = { id: '1', requester_id: 'user1' };
      const mockHistory = [
        { id: 'h1', field_name: 'status', old_value: 'OPEN', new_value: 'IN_PROGRESS' },
        { id: 'h2', field_name: 'priority', old_value: 'MEDIUM', new_value: 'HIGH' },
      ];

      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.ticketHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory('1', 'adminId', Role.ADMIN);

      expect(result).toEqual(mockHistory);
      expect(mockPrismaService.ticketHistory.findMany).toHaveBeenCalledWith({
        where: { ticket_id: '1' },
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          created_at: 'asc',
        },
      });
    });

    it('should allow AGENT to get history of their own ticket', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'agent1' };
      const mockHistory = [
        { id: 'h1', field_name: 'status', old_value: 'OPEN', new_value: 'IN_PROGRESS' },
      ];

      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.ticketHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory('1', 'agent1', Role.AGENT);

      expect(result).toEqual(mockHistory);
    });

    it('should forbid AGENT from getting history of others tickets', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'otherAgent' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);

      await expect(service.getHistory('1', 'agent1', Role.AGENT)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getHistory('1', 'agent1', Role.AGENT)).rejects.toThrow(
        'You can only view history of your own tickets',
      );
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('1', 'user1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignTicket', () => {
    it('should not assign a ticket to a CLIENT', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue({
        id: '1',
        assigned_to_id: null,
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'client1',
        role: Role.CLIENT,
      });

      await expect(
        service.assignTicket(
          '1',
          { assigned_to_id: 'client1' },
          'admin1',
          Role.ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
