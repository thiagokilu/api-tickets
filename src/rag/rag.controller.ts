
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/role-guard.js';
import { Role } from '../generated/prisma/enums.js';
import { RagService } from './rag.service.js';
import { RagIngestionService } from '../rag-ingestion/rag-ingestion.service.js';

@Controller('rag')
@UseGuards(AuthGuard('jwt'))
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly ingestion: RagIngestionService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('index')
  async index() {
    return this.ingestion.indexDocuments();
  }

  @Post('ask')
  async ask(@Body('question') question: string) {
    return this.ragService.ask(question);
  }
}
