import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../services/prisma.js';
import { Role } from '../generated/prisma/enums.js';
import { SendTicketChatMessageDto } from './dto/ticket-chat.dto.js';

@Injectable()
export class TicketChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessages(ticketId: string, userId: string, role: Role) {
    await this.assertCanAccessTicket(ticketId, userId, role);
    return this.prisma.ticketMessage.findMany({
      where: { ticket_id: ticketId },
      include: {
        user: { select: { id: true, username: true, email: true, role: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async sendMessage(
    ticketId: string,
    dto: SendTicketChatMessageDto,
    userId: string,
    role: Role,
  ) {
    await this.assertCanAccessTicket(ticketId, userId, role);
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          ticket_id: ticketId,
          user_id: userId,
          content: dto.message,
          attachments: [],
        },
        include: {
          user: { select: { id: true, username: true, email: true, role: true } },
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

  async assertCanAccessTicket(ticketId: string, userId: string, role: Role) {
    const ticket = await this.prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, requester_id: true, assigned_to_id: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const canAccess =
      role === Role.ADMIN ||
      (role === Role.CLIENT && ticket.requester_id === userId) ||
      (role === Role.AGENT && ticket.assigned_to_id === userId);
    if (!canAccess) throw new ForbiddenException('You cannot access this ticket chat');
    return ticket;
  }
}
