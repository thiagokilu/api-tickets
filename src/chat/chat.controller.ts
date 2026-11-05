import { Controller, Post, Body, Sse, MessageEvent, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/chat-dto.js';
import { Observable } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // POST /chat - Retorna a resposta completa quando terminar de gerar
  @Post()
  async chat(@Body() dto: SendMessageDto, @Request() req: any) {
    const reply = await this.chatService.sendMessage(dto, req.user.userId, req.user.role);
    return { reply };
  }

  // POST /chat/stream - Transmite pedaços de texto conforme são gerados
  @Post('stream')
  @Sse()
  chatStream(@Body() dto: SendMessageDto, @Request() req: any): Observable<MessageEvent> {
    return this.chatService.sendMessageStream(dto, req.user.userId, req.user.role);
  }
}