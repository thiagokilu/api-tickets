
import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service.js';
import { RagIngestionService } from '../rag-ingestion/rag-ingestion.service.js';

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ingestion: RagIngestionService,
  ) {}

  @Post('index')
  async index() {
    return this.ingestion.indexDocuments();
  }

  @Post('ask')
  async ask(@Body('question') question: string) {
    return this.ragService.ask(question);
  }
}
