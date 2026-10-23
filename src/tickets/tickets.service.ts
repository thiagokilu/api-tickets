import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';
import { PrismaService } from '../services/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { Role, TicketStatus } from '../generated/prisma/enums.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { FilterTicketsDto } from './dto/filter-tickets.dto.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTicketDto: CreateTicketDto, userId: string) {
    const include = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.tickets.create({
        data: {
          title: createTicketDto.title,
          description: createTicketDto.description,
          status: TicketStatus.OPEN,
          priority: null,
          requester_id: userId,
          category_id: createTicketDto.category_id,
          client_files: createTicketDto.client_files || [],
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

  findAll(userId: string, userRole: Role, filters: FilterTicketsDto = {}) {
    const include = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

    // Filtros opcionais
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.category_id != null) {
      where.category_id = Number(filters.category_id);
    }

    // ADMIN pode ver todos os tickets
    if (userRole === Role.ADMIN) {
      return this.prisma.tickets.findMany({
        where,
        include,
      });
    }

    // AGENT só pode ver tickets atribuídos a ele
    if (userRole === Role.AGENT) {
      return this.prisma.tickets.findMany({
        where: {
          ...where,
          assigned_to_id: userId,
        },
        include,
      });
    }

    // CLIENT só pode ver seus próprios tickets (requester_id)
    if (userRole === Role.CLIENT) {
      return this.prisma.tickets.findMany({
        where: {
          ...where,
          requester_id: userId,
        },
        include,
      });
    }

    throw new ForbiddenException('You are not authorized to view tickets');
  }

  async findOne(id: string, userId: string, userRole: Role) {
    const include = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

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

    const include = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

    const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
      OPEN: ['IN_PROGRESS', 'CLOSED'],
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

      await this.recordTicketHistory(
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
      ...(updateTicketDto.client_files !== undefined && {
        client_files: updateTicketDto.client_files,
      }),
    };

    // Atualizar resolved_at e closed_at automaticamente com base no status
    if (updateTicketDto.status !== undefined) {
      data.status = updateTicketDto.status;

      if (updateTicketDto.status === TicketStatus.RESOLVED) {
        data.resolved_at = new Date();
      } else {
        data.resolved_at = null;
      }

      if (updateTicketDto.status === TicketStatus.CLOSED) {
        data.closed_at = new Date();
      } else {
        data.closed_at = null;
      }
    }

    return data;
  }

  private async recordTicketHistory(
    prisma: Prisma.TransactionClient | PrismaService,
    ticket: any,
    updateTicketDto: UpdateTicketDto,
    ticketId: string,
    userId: string,
  ) {
    // Registrar mudança de title
    if (updateTicketDto.title !== undefined && updateTicketDto.title !== ticket.title) {
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'title',
          old_value: ticket.title,
          new_value: updateTicketDto.title,
        },
      });
    }

    // Registrar mudança de description
    if (updateTicketDto.description !== undefined && updateTicketDto.description !== ticket.description) {
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'description',
          old_value: ticket.description,
          new_value: updateTicketDto.description,
        },
      });
    }

    // Registrar mudança de priority
    if (updateTicketDto.priority !== undefined && updateTicketDto.priority !== ticket.priority) {
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'priority',
          old_value: ticket.priority,
          new_value: updateTicketDto.priority,
        },
      });
    }

    // Registrar mudança de status
    if (updateTicketDto.status !== undefined && updateTicketDto.status !== ticket.status) {
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'status',
          old_value: ticket.status,
          new_value: updateTicketDto.status,
        },
      });
    }

    // Registrar mudança de category_id
    if (updateTicketDto.category_id !== undefined && updateTicketDto.category_id !== ticket.category_id) {
      await prisma.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'category_id',
          old_value: ticket.category_id?.toString() || null,
          new_value: updateTicketDto.category_id?.toString() || null,
        },
      });
    }

    // Registrar mudança de client_files
    if (updateTicketDto.client_files !== undefined) {
      const oldFiles = JSON.stringify(ticket.client_files || []);
      const newFiles = JSON.stringify(updateTicketDto.client_files || []);
      if (oldFiles !== newFiles) {
        await prisma.ticketHistory.create({
          data: {
            ticket_id: ticketId,
            actor_id: userId,
            field_name: 'client_files',
            old_value: oldFiles,
            new_value: newFiles,
          },
        });
      }
    }
  }

  async remove(id: string, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ADMIN pode deletar qualquer ticket
    if (userRole === Role.ADMIN) {
      return this.prisma.tickets.delete({
        where: { id },
      });
    }

    // AGENT só pode deletar SEUS PRÓPRIOS tickets (assigned_to_id)
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only delete your own tickets');
      }
      return this.prisma.tickets.delete({
        where: { id },
      });
    }

    throw new ForbiddenException('You are not authorized to delete tickets');
  }

  async getHistory(ticketId: string, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ADMIN pode ver histórico de qualquer ticket
    if (userRole === Role.ADMIN) {
      return this.prisma.ticketHistory.findMany({
        where: { ticket_id: ticketId },
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
    }

    // AGENT só pode ver histórico de tickets atribuídos a ele
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only view history of your own tickets');
      }
      return this.prisma.ticketHistory.findMany({
        where: { ticket_id: ticketId },
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
    }

    throw new ForbiddenException('You are not authorized to view history');
  }

  async addMessage(ticketId: string, createMessageDto: CreateMessageDto, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ADMIN pode adicionar mensagens em qualquer ticket
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only add messages to your assigned tickets');
      }
    }

    // CLIENT só pode adicionar mensagens em seus próprios tickets (requester_id)
    else if (userRole === Role.CLIENT) {
      if (ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only add messages to your own tickets');
      }
    }

    else if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to add messages');
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticket_id: ticketId,
          user_id: userId,
          content: createMessageDto.content,
          attachments: createMessageDto.attachments || [],
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      });

      await tx.ticketHistory.create({
        data: {
          ticket_id: ticketId,
          actor_id: userId,
          field_name: 'message_added',
          old_value: null,
          new_value: message.id,
        },
      });

      return message;
    });
  }

  async getMessages(ticketId: string, userId: string, userRole: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // ADMIN pode ver mensagens de qualquer ticket
    if (userRole === Role.ADMIN) {
      return this.prisma.ticketMessage.findMany({
        where: { ticket_id: ticketId },
        include: {
          user: {
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
    }

    // AGENT só pode ver mensagens de tickets atribuídos a ele
    if (userRole === Role.AGENT) {
      if (ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only view messages from your assigned tickets');
      }
      return this.prisma.ticketMessage.findMany({
        where: { ticket_id: ticketId },
        include: {
          user: {
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
    }

    // CLIENT só pode ver mensagens de seus próprios tickets (requester_id)
    if (userRole === Role.CLIENT) {
      if (ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only view messages from your own tickets');
      }
      return this.prisma.ticketMessage.findMany({
        where: { ticket_id: ticketId },
        include: {
          user: {
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
    }

    throw new ForbiddenException('You are not authorized to view messages');
  }

  async updateMessage(messageId: string, updateMessageDto: UpdateMessageDto, userId: string, userRole: Role) {
    const message = await this.prisma.ticketMessage.findUnique({
      where: { id: messageId },
      include: {
        ticket: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // ADMIN pode editar qualquer mensagem
    if (userRole === Role.AGENT) {
      if (message.user_id !== userId) {
        throw new ForbiddenException('You can only edit your own messages');
      }
      if (message.ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only edit messages from your assigned tickets');
      }
    }

    // CLIENT só pode editar suas próprias mensagens em seus tickets
    else if (userRole === Role.CLIENT) {
      if (message.user_id !== userId) {
        throw new ForbiddenException('You can only edit your own messages');
      }
      if (message.ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only edit messages from your own tickets');
      }
    }

    else if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to edit messages');
    }

    return this.updateMessageWithHistory(
      message,
      messageId,
      updateMessageDto,
      userId,
    );
  }

  private updateMessageWithHistory(
    message: any,
    messageId: string,
    updateMessageDto: UpdateMessageDto,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updatedMessage = await tx.ticketMessage.update({
        where: { id: messageId },
        data: updateMessageDto,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (updateMessageDto.content !== undefined && updateMessageDto.content !== message.content) {
        await tx.ticketHistory.create({
          data: {
            ticket_id: message.ticket_id,
            actor_id: userId,
            field_name: 'message_content',
            old_value: message.content,
            new_value: updateMessageDto.content,
          },
        });
      }

      if (updateMessageDto.attachments !== undefined) {
        await tx.ticketHistory.create({
          data: {
            ticket_id: message.ticket_id,
            actor_id: userId,
            field_name: 'message_attachments',
            old_value: JSON.stringify(message.attachments),
            new_value: JSON.stringify(updateMessageDto.attachments),
          },
        });
      }

      return updatedMessage;
    });
  }

  async deleteMessage(messageId: string, userId: string, userRole: Role) {
    const message = await this.prisma.ticketMessage.findUnique({
      where: { id: messageId },
      include: {
        ticket: true,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // ADMIN pode deletar qualquer mensagem
    if (userRole === Role.AGENT) {
      if (message.user_id !== userId) {
        throw new ForbiddenException('You can only delete your own messages');
      }
      if (message.ticket.assigned_to_id !== userId) {
        throw new ForbiddenException('You can only delete messages from your assigned tickets');
      }
    }

    // CLIENT só pode deletar suas próprias mensagens em seus tickets
    else if (userRole === Role.CLIENT) {
      if (message.user_id !== userId) {
        throw new ForbiddenException('You can only delete your own messages');
      }
      if (message.ticket.requester_id !== userId) {
        throw new ForbiddenException('You can only delete messages from your own tickets');
      }
    }

    else if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('You are not authorized to delete messages');
    }

    return this.prisma.$transaction(async (tx) => {
      const deletedMessage = await tx.ticketMessage.delete({
        where: { id: messageId },
      });

      await tx.ticketHistory.create({
        data: {
          ticket_id: message.ticket_id,
          actor_id: userId,
          field_name: 'message_deleted',
          old_value: message.content,
          new_value: null,
        },
      });

      return deletedMessage;
    });
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

    const include = {
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      assigned_to: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
        },
      },
      messages: {
        select: {
          id: true,
          content: true,
          attachments: true,
          created_at: true,
          updated_at: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
            },
          },
        },
      },
    };

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
