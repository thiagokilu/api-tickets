import { Controller, Post, Body, Sse, MessageEvent, UseGuards, Request } from '@nestjs/common';
import { AiChatService } from './ai-chat.service.js';
import { SendAiAiChatMessageDto } from './dto/ai-chat.dto.js';
import { Observable } from 'rxjs';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
@ApiTags('Chat com IA')
@ApiBearerAuth()
export class AiChatController {
  constructor(private readonly chatService: AiChatService) {}

  // POST /chat - Retorna a resposta completa quando terminar de gerar
  @Post()
  @ApiOperation({
    summary: 'Envia uma mensagem ao chat de IA',
    description: 'Para continuar uma conversa, envie em `history` todas as mensagens anteriores em ordem cronológica. O servidor não persiste o histórico. A resposta é retornada no campo `reply`.',
  })
  async chat(@Body() dto: SendAiAiChatMessageDto, @Request() req: any) {
    const reply = await this.chatService.sendMessage(dto, req.user.userId, req.user.role);
    return { reply };
  }

  // POST /chat/stream - Transmite pedaços de texto conforme são gerados
  @Post('stream')
  @Sse()
  @ApiOperation({
    summary: 'Envia uma mensagem ao chat de IA com resposta em streaming',
    description: 'Aceita o mesmo corpo de `POST /chat`. Reenvie em `history` as mensagens anteriores em ordem cronológica para manter o contexto da conversa.',
  })
  chatStream(@Body() dto: SendAiAiChatMessageDto, @Request() req: any): Observable<MessageEvent> {
    return this.chatService.sendMessageStream(dto, req.user.userId, req.user.role);
  }
}
