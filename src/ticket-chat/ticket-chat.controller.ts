import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TicketChatService } from './ticket-chat.service.js';
import { SendTicketChatMessageDto } from './dto/ticket-chat.dto.js';

@Controller('ticket-chat/:ticketId/messages')
@UseGuards(AuthGuard('jwt'))
@ApiTags('Ticket chat')
@ApiBearerAuth()
export class TicketChatController {
  constructor(private readonly chatService: TicketChatService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as mensagens do chat do ticket' })
  getMessages(@Param('ticketId') ticketId: string, @Request() req: any) {
    return this.chatService.getMessages(
      ticketId,
      req.user.userId,
      req.user.role,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Envia uma mensagem no chat do ticket' })
  sendMessage(
    @Param('ticketId') ticketId: string,
    @Body() dto: SendTicketChatMessageDto,
    @Request() req: any,
  ) {
    return this.chatService.sendMessage(
      ticketId,
      dto,
      req.user.userId,
      req.user.role,
    );
  }
}
