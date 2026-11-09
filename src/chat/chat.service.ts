import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { SendMessageDto } from './dto/chat-dto.js';
import { Observable } from 'rxjs';
import { PrismaService } from '../services/prisma.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import {MarkdownTextSplitter} from   '@langchain/textsplitters';

@Injectable()
export class ChatService {
  private readonly langchainAi: ChatOpenAI;
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.langchainAi = new ChatOpenAI({
      model: this.configService.getOrThrow<string>('NVIDIA_MODEL'),
      apiKey: this.configService.getOrThrow<string>('NVIDIA_API_KEY'),
      configuration: {
        baseURL: this.configService.getOrThrow<string>('NVIDIA_BASE_URL'),
      },
      // Gerações longas podem demorar mais que o timeout padrão do cliente.
      timeout: 300_000,
    });
  }

  private async getSupportGuideContent(): Promise<string> {
    try {
      const supportGuidePath = join(process.cwd(), 'src', 'documents', 'suport.md');
      const splitter = new MarkdownTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const content = readFileSync(supportGuidePath, 'utf-8');
      const chunks = await splitter.splitText(content);
      return chunks.join('\n\n');
    } catch (error) {
      this.logger.error('Erro ao ler guia de suporte', error);
      return '';
    }
  }

  private async getTicketsContext(
    userId: string,
    role: string,
    ticketId?: string,
  ): Promise<string> {
    try {
      let whereClause: any = {
        ...(ticketId
          ? { id: ticketId }
          : { status: { in: ['OPEN', 'IN_PROGRESS'] } }),
      };

      if (role === 'CLIENT') {
        whereClause.requester_id = userId;
      }

      const tickets = await this.prisma.tickets.findMany({
        where: whereClause,
        include: {
          requester: { select: { username: true, email: true } },
          assigned_to: { select: { username: true } },
          category: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      if (tickets.length === 0) {
        if (ticketId) {
          return `Nenhum ticket com o ID ${ticketId} foi encontrado ou você não tem acesso a ele.`;
        }
        return role === 'CLIENT'
          ? 'Você não possui tickets abertos ou em andamento no momento.'
          : 'Não há tickets abertos ou em andamento no momento.';
      }

      const ticketsText = tickets
        .map(
          (ticket) =>
            `- ID: ${ticket.id}\n  Título: ${ticket.title}\n  Descrição: ${ticket.description}\n  Status: ${ticket.status}\n  Prioridade: ${ticket.priority || 'Não definida'}\n  Solicitante: ${ticket.requester.username} (${ticket.requester.email})\n  Atribuído a: ${ticket.assigned_to?.username || 'Não atribuído'}\n  Categoria: ${ticket.category?.name || 'Não definida'}\n  Criado em: ${ticket.created_at.toISOString()}`,
        )
        .join('\n\n');

      return `Tickets disponíveis:\n\n${ticketsText}`;
    } catch (error) {
      this.logger.error('Erro ao buscar tickets do banco de dados', error);
      return 'Erro ao buscar tickets do banco de dados.';
    }
  }

  private async buildMessages(dto: SendMessageDto, userId: string, role: string) {
    const ticketsContext = await this.getTicketsContext(userId, role, dto.ticketId);
    const supportGuide = await this.getSupportGuideContent();
    const messages: (SystemMessage | HumanMessage | AIMessage)[] = [
      new SystemMessage(
        `Você é um assistente virtual prestativo e objetivo especializado em suporte técnico. Você tem acesso aos tickets do sistema de suporte e deve seguir estritamente o guia de soluções de problemas abaixo.\n\n=== GUIA DE SUPORTE ===\n${supportGuide}\n=== FIM DO GUIA ===\n\n=== TICKETS DISPONÍVEIS ===\n${ticketsContext}\n=== FIM DOS TICKETS ===\n\nUse essas informações para responder perguntas sobre os tickets e seguir os procedimentos padrão do guia de suporte. Sempre que um usuário descrever um problema, consulte o guia para identificar a solução mais adequada e siga os passos recomendados. Quando o contexto indicar que o ticket solicitado não foi encontrado, informe isso claramente e não invente informações.`,
      ),
    ];

    if (dto.history?.length) {
      for (const item of dto.history) {
        if (item.role === 'user') {
          messages.push(new HumanMessage(item.text));
        } else if (item.role === 'model') {
          messages.push(new AIMessage(item.text));
        }
      }
    }

    messages.push(new HumanMessage(dto.message));
    return messages;
  }

  async sendMessage(dto: SendMessageDto, userId: string, role: string): Promise<string> {
    this.logger.log(
      `Mensagem recebida para resposta completa (${this.describeRequest(dto)})`,
    );
    this.logger.debug('Montando mensagens e enviando requisição para o modelo');

    try {
      const response = await this.langchainAi.invoke(await this.buildMessages(dto, userId, role));
      const content = response.content as string;

      this.logger.log(
        `Resposta recebida do modelo (${content.length} caracteres)`,
      );
      return content;
    } catch (error) {
      this.logError('Erro ao obter resposta completa do modelo', error);
      throw error;
    }
  }

  async *streamChunks(dto: SendMessageDto, userId: string, role: string): AsyncGenerator<string> {
    this.logger.log(
      `Mensagem recebida para streaming (${this.describeRequest(dto)})`,
    );
    this.logger.debug('Montando mensagens e iniciando streaming com o modelo');

    let chunkCount = 0;
    let characterCount = 0;

    try {
      const stream = await this.langchainAi.stream(await this.buildMessages(dto, userId, role));
      this.logger.debug('Streaming iniciado; aguardando chunks do modelo');

      for await (const chunk of stream) {
        const content = chunk.content as string;
        if (content) {
          chunkCount += 1;
          characterCount += content.length;
          this.logger.debug(
            `Chunk recebido do modelo #${chunkCount} (${content.length} caracteres)`,
          );
          yield content;
        }
      }

      this.logger.log(
        `Streaming concluído (${chunkCount} chunks, ${characterCount} caracteres)`,
      );
    } catch (error) {
      this.logError(`Erro durante streaming após ${chunkCount} chunks`, error);
      throw error;
    }
  }

  sendMessageStream(dto: SendMessageDto, userId: string, role: string): Observable<MessageEvent> {
    this.logger.log('Preparando resposta SSE para a mensagem recebida');

    return new Observable((subscriber) => {
      void (async () => {
        try {
          for await (const text of this.streamChunks(dto, userId, role)) {
            subscriber.next({ data: { text } });
          }
          subscriber.complete();
          this.logger.log('Resposta SSE enviada e encerrada com sucesso');
        } catch (error) {
          this.logError('Erro ao enviar resposta SSE', error);
          subscriber.error(error);
        }
      })();
    });
  }

  private describeRequest(dto: SendMessageDto): string {
    const ticketContext = dto.ticketId ? `, ticket ${dto.ticketId}` : '';
    return `${dto.message.length} caracteres, ${dto.history?.length ?? 0} mensagens no histórico${ticketContext}`;
  }

  private logError(context: string, error: unknown): void {
    this.logger.error(
      context,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
