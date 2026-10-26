import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../services/prisma.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { UpdateMessageDto } from './dto/update-message.dto.js';

@Injectable()
export class TicketMessagesService {
  constructor(private readonly prisma: PrismaService) {}

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

}
