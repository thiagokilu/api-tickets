import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { PrismaService } from '../services/prisma.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, TicketStatus } from '../generated/prisma/enums.js';
import { vi } from 'vitest';

describe('TicketsService', () => {
  let service: TicketsService;
  let historyService: TicketHistoryService;

  const mockPrismaService = {
    $transaction: vi.fn(async (callback) => callback(mockPrismaService)),
    tickets: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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
        TicketHistoryService,
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    historyService = module.get<TicketHistoryService>(TicketHistoryService);
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
        priority: 'MEDIUM',
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
            priority: 'MEDIUM',
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
      mockPrismaService.tickets.count.mockResolvedValue(0);

      const result = await service.findAll('adminId', Role.ADMIN, {
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
      expect(mockPrismaService.tickets.count).toHaveBeenCalledWith({
        where: {
          status: 'OPEN',
          priority: 'HIGH',
          category_id: 3,
        },
      });
      expect(result).toEqual({
        data: [],
        meta: expect.objectContaining({
          total: 0,
          currentPage: 1,
          perPage: 10,
        }),
      });
    });

    it('should restrict AGENT to their assigned tickets', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);
      mockPrismaService.tickets.count.mockResolvedValue(0);

      await service.findAll('agent1', Role.AGENT, {});

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assigned_to_id: 'agent1' },
        }),
      );
    });

    it('should restrict CLIENT to their own tickets', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);
      mockPrismaService.tickets.count.mockResolvedValue(0);

      await service.findAll('client1', Role.CLIENT, {});

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requester_id: 'client1' },
        }),
      );
    });

    it('should order by created_at desc with id tiebreaker', async () => {
      mockPrismaService.tickets.findMany.mockResolvedValue([]);
      mockPrismaService.tickets.count.mockResolvedValue(0);

      await service.findAll('adminId', Role.ADMIN, {});

      expect(mockPrismaService.tickets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        }),
      );
    });
  });

  describe('remove', () => {
    it('should allow ADMIN to delete any ticket', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'user1' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.tickets.delete.mockResolvedValue(mockTicket);

      const result = await service.remove('1', Role.ADMIN);

      expect(result).toEqual(mockTicket);
      expect(mockPrismaService.tickets.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should forbid AGENT from deleting any ticket', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'agent1' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);

      await expect(service.remove('1', Role.AGENT)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove('1', Role.AGENT)).rejects.toThrow(
        'Only administrators can delete tickets',
      );
    });

    it('should forbid CLIENT from deleting any ticket', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.remove('1', Role.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue(null);

      await expect(service.remove('1', Role.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('1', Role.ADMIN)).rejects.toThrow(
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

      const result = await historyService.getHistory('1', 'adminId', Role.ADMIN);

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

      const result = await historyService.getHistory('1', 'agent1', Role.AGENT);

      expect(result).toEqual(mockHistory);
    });

    it('should forbid AGENT from getting history of others tickets', async () => {
      const mockTicket = { id: '1', assigned_to_id: 'otherAgent' };
      mockPrismaService.tickets.findUnique.mockResolvedValue(mockTicket);

      await expect(historyService.getHistory('1', 'agent1', Role.AGENT)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(historyService.getHistory('1', 'agent1', Role.AGENT)).rejects.toThrow(
        'You can only view history of your own tickets',
      );
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue(null);

      await expect(historyService.getHistory('1', 'user1', Role.ADMIN)).rejects.toThrow(
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

  describe('update', () => {
    it('should not allow transition from OPEN to CLOSED', async () => {
      mockPrismaService.tickets.findUnique.mockResolvedValue({
        id: '1',
        status: TicketStatus.OPEN,
        assigned_to_id: 'admin1',
      });

      await expect(
        service.update(
          '1',
          { status: TicketStatus.CLOSED },
          'admin1',
          Role.ADMIN,
        ),
      ).rejects.toThrow(new ForbiddenException('Invalid ticket status transition'));
    });

    it('should allow transition from OPEN to IN_PROGRESS', async () => {
      const existingTicket = {
        id: '1',
        title: 'Original Title',
        status: TicketStatus.OPEN,
        assigned_to_id: 'admin1',
      };
      const updatedTicket = {
        ...existingTicket,
        status: TicketStatus.IN_PROGRESS,
      };

      mockPrismaService.tickets.findUnique.mockResolvedValue(existingTicket);
      mockPrismaService.tickets.update.mockResolvedValue(updatedTicket);
      mockPrismaService.ticketHistory.create.mockResolvedValue({});

      const result = await service.update(
        '1',
        { status: TicketStatus.IN_PROGRESS },
        'admin1',
        Role.ADMIN,
      );

      expect(result.status).toEqual(TicketStatus.IN_PROGRESS);
    });

    it('should set resolved_at when changing status to RESOLVED', async () => {
      const existingTicket = {
        id: '1',
        title: 'Original Title',
        status: TicketStatus.IN_PROGRESS,
        assigned_to_id: 'admin1',
        resolved_at: null,
      };

      mockPrismaService.tickets.findUnique.mockResolvedValue(existingTicket);
      mockPrismaService.tickets.update.mockImplementation(async ({ data }) => ({
        ...existingTicket,
        ...data,
      }));
      mockPrismaService.ticketHistory.create.mockResolvedValue({});

      const result = await service.update(
        '1',
        { status: TicketStatus.RESOLVED },
        'admin1',
        Role.ADMIN,
      );

      expect(result.status).toEqual(TicketStatus.RESOLVED);
      expect(result.resolved_at).toBeInstanceOf(Date);
      expect(result.closed_at).toBeNull();
    });

    it('should preserve resolved_at and set closed_at when changing status from RESOLVED to CLOSED', async () => {
      const resolvedDate = new Date('2026-10-20T10:00:00Z');
      const existingTicket = {
        id: '1',
        title: 'Original Title',
        status: TicketStatus.RESOLVED,
        resolved_at: resolvedDate,
        closed_at: null,
        assigned_to_id: 'admin1',
      };

      mockPrismaService.tickets.findUnique.mockResolvedValue(existingTicket);
      mockPrismaService.tickets.update.mockImplementation(async ({ data }) => ({
        ...existingTicket,
        ...data,
        resolved_at: data.resolved_at !== undefined ? data.resolved_at : existingTicket.resolved_at,
      }));
      mockPrismaService.ticketHistory.create.mockResolvedValue({});

      const result = await service.update(
        '1',
        { status: TicketStatus.CLOSED },
        'admin1',
        Role.ADMIN,
      );

      expect(mockPrismaService.tickets.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            resolved_at: null,
          }),
        }),
      );
      expect(result.status).toEqual(TicketStatus.CLOSED);
      expect(result.resolved_at).toEqual(resolvedDate);
      expect(result.closed_at).toBeInstanceOf(Date);
    });

    it('should clear resolved_at and closed_at when reopening ticket to OPEN', async () => {
      const existingTicket = {
        id: '1',
        title: 'Original Title',
        status: TicketStatus.RESOLVED,
        resolved_at: new Date('2026-10-20T10:00:00Z'),
        closed_at: null,
        assigned_to_id: 'admin1',
      };

      mockPrismaService.tickets.findUnique.mockResolvedValue(existingTicket);
      mockPrismaService.tickets.update.mockImplementation(async ({ data }) => ({
        ...existingTicket,
        ...data,
      }));
      mockPrismaService.ticketHistory.create.mockResolvedValue({});

      const result = await service.update(
        '1',
        { status: TicketStatus.OPEN },
        'admin1',
        Role.ADMIN,
      );

      expect(result.status).toEqual(TicketStatus.OPEN);
      expect(result.resolved_at).toBeNull();
      expect(result.closed_at).toBeNull();
    });
  });
});
