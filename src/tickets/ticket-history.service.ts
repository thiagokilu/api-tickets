import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../services/prisma.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';

@Injectable()
export class TicketHistoryService {
  constructor(private readonly prisma: PrismaService) {}

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

  async recordTicketHistory(
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

  }

}
