import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { PrismaService } from '../services/prisma.js';
import { Role, TicketPriority, TicketStatus } from '../generated/prisma/enums.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { FilterTicketsDto } from './dto/filter-tickets.dto.js';
import { TICKET_INCLUDE } from './ticket.includes.js';
import { TicketHistoryService } from './ticket-history.service.js';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketHistoryService: TicketHistoryService,
  ) {}

  async create(createTicketDto: CreateTicketDto, userId: string) {
    const include = TICKET_INCLUDE;

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.tickets.create({
        data: {
          title: createTicketDto.title,
          description: createTicketDto.description,
          status: TicketStatus.OPEN,
          priority: TicketPriority.MEDIUM,
          requester_id: userId,
          category_id: createTicketDto.category_id,
          client_files: [],
        },
        include,
      });

      await tx.ticketHistory.create({
        data: {
          ticket_id: ticket.id,
          actor_id: userId,
          field_name: 'ticket_created',
          old_value: null,
          new_value: JSON.stringify({
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            category_id: ticket.category_id,
          }),
        },
      });

      return ticket;
    });
  }

  async findAll(userId: string, userRole: Role, filters: FilterTicketsDto = {}) {
    const include = TICKET_INCLUDE;

    // Paginação
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    const maxPerPage = 100;

    if (perPage > maxPerPage) {
      throw new BadRequestException('perPage cannot exceed 100');
    }
    const skip = (page - 1) * perPage;

    // Filtros opcionais
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category_id != null) {
      where.category_id = Number(filters.category_id);
    }

    // Restrição por role
    if (userRole === Role.AGENT) {
      where.assigned_to_id = userId;
    } else if (userRole === Role.CLIENT) {
      where.requester_id = userId;
    } else if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to view tickets');
    }

    const [data, total] = await Promise.all([
      this.prisma.tickets.findMany({
        where,
        include,
        skip,
        take: perPage,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.tickets.count({ where }),
    ]);

    const lastPage = Math.ceil(total / perPage);

    return {
      data,
      meta: {
        total,
        lastPage,
        currentPage: page,
        perPage,
        prev: page > 1 ? page - 1 : null,
        next: page < lastPage ? page + 1 : null,
      },
    };
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const include = TICKET_INCLUDE;

    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
      include,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ADMIN pode ver qualquer ticket
    if (userRole === Role.ADMIN) {
      return ticket;
    }

    // AGENT só pode ver tickets atribuídos a ele
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only view your own tickets');
      }
      return ticket;
    }

    // CLIENT só pode ver seus próprios tickets (requester_id)
    if (userRole === Role.CLIENT) {
      if (ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only view your own tickets');
      }
      return ticket;
    }

    throw new ForbiddenException('You are not authorized to view tickets');
  }

  async update(id: string, updateTicketDto: UpdateTicketDto, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const include = TICKET_INCLUDE;

    const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
      OPEN: ['IN_PROGRESS'],
      IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'RESOLVED', 'OPEN'],
      WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'OPEN'],
      CLOSED: ['OPEN'],
    };

    if (updateTicketDto.status !== undefined) {
      if (!allowedTransitions[ticket.status]?.includes(updateTicketDto.status)) {
        throw new ForbiddenException('Invalid ticket status transition');
      }
    }

    // ADMIN pode editar qualquer ticket (sem restrições de campos)
    if (userRole === Role.ADMIN) {
      return this.updateTicketWithHistory(
        ticket,
        updateTicketDto,
        id,
        userId,
        include,
      );
    }

    // AGENT só pode editar tickets atribuídos a ele
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only edit tickets assigned to you');
      }
      return this.updateTicketWithHistory(
        ticket,
        updateTicketDto,
        id,
        userId,
        include,
      );
    }

    // CLIENT pode editar apenas título, descrição, categoria e arquivos dos seus próprios tickets
    // NÃO pode mexer em status, prioridade
    if (userRole === Role.CLIENT) {
      if (ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only edit your own tickets');
      }

      // Bloquear campos restritos para o CLIENT
      if (updateTicketDto.status !== undefined) {
        throw new ForbiddenException('Clients are not allowed to change ticket status');
      }
      if (updateTicketDto.priority !== undefined) {
        throw new ForbiddenException('Clients are not allowed to change ticket priority');
      }

      return this.updateTicketWithHistory(
        ticket,
        updateTicketDto,
        id,
        userId,
        include,
      );
    }

    throw new ForbiddenException('You are not authorized to edit tickets');
  }

  private updateTicketWithHistory(
    ticket: any,
    updateTicketDto: UpdateTicketDto,
    ticketId: string,
    userId: string,
    include: any,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: this.getUpdateData(updateTicketDto),
        include,
      });

      await this.ticketHistoryService.recordTicketHistory(
        tx,
        ticket,
        updateTicketDto,
        ticketId,
        userId,
      );

      return updatedTicket;
    });
  }

  private getUpdateData(updateTicketDto: UpdateTicketDto) {
    const data: Record<string, any> = {
      ...(updateTicketDto.title !== undefined && { title: updateTicketDto.title }),
      ...(updateTicketDto.description !== undefined && {
        description: updateTicketDto.description,
      }),
      ...(updateTicketDto.priority !== undefined && { priority: updateTicketDto.priority }),
      ...(updateTicketDto.category_id !== undefined && {
        category_id: updateTicketDto.category_id,
      }),
    };

    // Atualizar resolved_at e closed_at automaticamente com base no status
    if (updateTicketDto.status !== undefined) {
      data.status = updateTicketDto.status;

      if (updateTicketDto.status === TicketStatus.RESOLVED) {
        data.resolved_at = new Date();
        data.closed_at = null;
      } else if (updateTicketDto.status === TicketStatus.CLOSED) {
        data.closed_at = new Date();
        // Não limpa resolved_at para preservar quando o ticket foi resolvido
      } else {
        data.resolved_at = null;
        data.closed_at = null;
      }
    }

    return data;
  }

  async remove(id: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (userRole === Role.ADMIN) {
      return this.prisma.tickets.delete({
        where: { id },
      });
    }

    throw new ForbiddenException('Only administrators can delete tickets');
  }

  async assignTicket(id: string, assignTicketDto: AssignTicketDto, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Verificar se o usuário existe apenas se assigned_to_id for fornecido
    if (assignTicketDto.assigned_to_id) {
      const userExiste = await this.prisma.user.findUnique({
        where: { id: assignTicketDto.assigned_to_id },
      });

      if (!userExiste) {
        throw new NotFoundException('User not found');
      }
      if (userExiste.role !== Role.AGENT && userExiste.role !== Role.ADMIN) {
        throw new ForbiddenException(
          'Tickets can only be assigned to agents or admins',
        );
      }
    }

    const include = TICKET_INCLUDE;

    let assignedToId: string | null;

    // ADMIN pode atribuir qualquer ticket
    if (userRole === Role.ADMIN) {
      assignedToId = assignTicketDto.assigned_to_id || null;
    }

    // AGENT só pode atribuir tickets a si mesmo
    else if (userRole === Role.AGENT) {
      // Se estiver atribuindo a alguém (não desatribuindo)
      if (assignTicketDto.assigned_to_id) {
        if (assignTicketDto.assigned_to_id !== userId) {
          throw new ForbiddenException('You can only assign tickets to yourself');
        }
        // Não pode pegar ticket já atribuído a outro agent
        if (ticket.assigned_to_id && ticket.assigned_to_id !== userId) {
          throw new ForbiddenException('This ticket is already assigned to another agent');
        }
      }
      // Se estiver desatribuindo, só pode desatribuir tickets que estão atribuídos a ele
      else {
        if (ticket.assigned_to_id !== userId) {
          throw new ForbiddenException('You can only unassign your own tickets');
        }
      }
      assignedToId = assignTicketDto.assigned_to_id || null;
    }

    else {
      throw new ForbiddenException('You are not authorized to assign tickets');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.tickets.update({
        where: { id },
        data: { assigned_to_id: assignedToId },
        include,
      });

      await tx.ticketHistory.create({
        data: {
          ticket_id: id,
          actor_id: userId,
          field_name: 'assigned_to_id',
          old_value: ticket.assigned_to_id,
          new_value: assignedToId,
        },
      });

      return updatedTicket;
    });
  }
}
